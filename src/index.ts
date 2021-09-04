import express from "express";
import morgan from "morgan";
import path from "path";
import rfs from "rotating-file-stream";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import http from "http";
import { normalizePort } from "./util";
import { SERVER_ROOT } from "./constants";

import { Users, UsersTable } from "./data/users";

import { Create, DbConnector } from "@lambda-team/ltdl";
import AuthController from "./routes/auth";
import DataController from "./routes/data";
import JWT, { JwtPayload } from "jsonwebtoken";
import { ItemsTable } from "./data/items";
import Migrator from "@lambda-team/ltdl/migrator/migrator";

const accessLogStream = rfs("access.log", {
  interval: "1d", // rotate daily
  path: path.join(SERVER_ROOT, "log"),
});

const app = express();

// Apache commons style logging
app.use(morgan("combined", { stream: accessLogStream }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(SERVER_ROOT, "public")));

const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);
const server = http.createServer(app);

(async () => {
  const db = await new DbConnector()
    .params({
      host: "0.0.0.0",
      port: 5432,
      user: "postgres",
      password: "lambdapass",
      database: "auth",
    }).connect();

  const usersTable = new UsersTable(db);
  const itemsTable = new ItemsTable(db);

  const migrator = new Migrator(db);
  await migrator.chain(1, (session) => {
    session.execute(Create.table(usersTable).build());
  }).chain(2, (session) => {
    session.execute(Create.table(itemsTable).build());
  }).execute();

  const users = new Users(usersTable, itemsTable);
  const authController = new AuthController(users);

  const auther = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const authorization = req.header("Authorization")!;
    if (!authorization || authorization.split(" ").length !== 2) {
      res.status(401);
      res.send({
        error: "Authorization header is invalid",
      });
      return;
    }

    const valid = users.verifyToken(authorization.split(" ")[1]);
    if (!valid) {
      res.status(401);
      res.send("");
      return;
    }

    next();
  };

  const dataController = new DataController(users, auther);

  app.use(authController.router());
  app.use(dataController.router());

  console.log("Starting application server");
  server.listen(port);
  console.log(`Server is up @ http://localhost:${port}`);
})();
