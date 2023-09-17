const { config } = require("dotenv");

config();

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const path = require("path");
const whatsapp = require("wa-multi-session");
const ip = require("ip");

const MainRouter = require("./app/routers");
const errorHandlerMiddleware = require("./app/middlewares/error_middleware");
const { connectToDatabase, saveDoc, deleteDoc } = require("./app/database");

const PORT = process.env.PORT || "5000";
const URL = process.env.URL || "";

const ID_TEMP = 1;

async function Application() {
  try {
    var app = express();
    let { db } = await connectToDatabase();

    app.use(morgan("dev"));
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.set("view engine", "ejs");

    // Public Path
    app.use("/p", express.static(path.resolve("public")));
    app.use("/p/*", (req, res) => res.status(404).send("Media Not Found"));

    app.use(MainRouter);

    app.use(errorHandlerMiddleware);

    // SSE starting endpoint
    // You can access url `http://localhost:3000/sse/<userId>`
    //
    // Caution:
    // This example exposes <userId> as URI parameter for testing purpose.
    // In reality, you should use one stored in req.session.
    //
    app.get("/sse/:id", async (req, res) => {
      const id = req.param.id;

      res.status(200).set({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Origin, X-Requested-With, Content-Type, Accept",
      });

      db.collection(process.env.MONGODB_BOT_STATUS)
        .watch()
        .on("change", (doc) => {
          console.log(doc);
          const { fullDocument } = doc;
          res.write(`data: ${JSON.stringify(fullDocument)}\n\n`);
        });
    });

    app.get("/test", (req, res) => {
      res.render("sse");
    });

    app.get("/onconnected", async (req, res) => {
      await saveDoc(ID_TEMP);
      res.send("onConnected");
    });

    app.get("/ondisconnected", async (req, res) => {
      await deleteDoc(ID_TEMP);
      res.send("onDisconnected");
    });

    app.set("port", PORT);
    var server = http.createServer(app);

    server.listen(PORT);

    server.on("listening", () =>
      console.log(`---------------------------------------------------------------------------
      WhatsApp-API-Typescript esta rodando! Acesse uma das URL's:
      Local: ${URL}${PORT}
      Externo: http://${ip.address()}:${PORT}
      QR: ${URL}${PORT}/start-session?session=${ID_TEMP}&scan=true
      ---------------------------------------------------------------------------`)
    );

    whatsapp.onConnected(async (session) => {
      await saveDoc(session);
      console.log("connected from c1 => ", session);
    });

    whatsapp.onDisconnected(async (session) => {
      await deleteDoc(session);
      console.log("disconnected from c2 => ", session);
    });

    whatsapp.onConnecting((session) => {
      console.log("connecting => ", session);
    });

    whatsapp.onMessageReceived(async (msg) => {
      if (msg.key.fromMe || msg.key.remoteJid.includes("status")) return;
      await whatsapp.readMessage({
        sessionId: msg.sessionId,
        key: msg.key,
      });
      await whatsapp.sendTyping({
        sessionId: msg.sessionId,
        to: msg.key.remoteJid,
        duration: 3000,
      });
      await whatsapp.sendTextMessage({
        sessionId: msg.sessionId,
        to: msg.key.remoteJid,
        text: "Hello!",
        answering: msg, // for quoting message
      });
    });

    whatsapp.loadSessionsFromStorage();
  } finally {
    // Ensures that the client will close when you finish/error
    function exitHandler(options, exitCode) {
      if (options.cleanup) console.log("clean");
      if (exitCode || exitCode === 0) console.log(exitCode);
      if (options.exit) process.exit();
    }

    //do something when app is closing
    process.on("exit", exitHandler.bind(null, { cleanup: true }));

    //catches ctrl+c event
    process.on("SIGINT", exitHandler.bind(null, { exit: true }));

    // catches "kill pid" (for example: nodemon restart)
    process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
    process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

    //catches uncaught exceptions
    process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
  }
}

(async () => {
  await Application().catch(console.dir);
})();
