import { Users } from "@/data/users";
import express, { Router } from "express";

export default class AuthController {
  private readonly _router: Router;
  private readonly users: Users;

  constructor(users: Users) {
    this._router = express.Router();
    this.users = users;

    this._router.post("/signup", async (req, res) => {
      const { email, password } = req.body;

      try {
        await this.users.signup(email, password);
      } catch (e) {
        console.error(e);
        res.status(403);
        res.send({ error: "user with this email already exists" });
      }
    });

    this._router.post("/login", async (req, res) => {
      const { email, password } = req.query;
      console.log(email, password);
      const { accessToken, refreshToken } = await this.users.login(
        email,
        password,
      );

      res.send({ accessToken, refreshToken });
    });

    this._router.post("/refresh", async (req, res) => {
      const refreshToken = req.header("Authorization")!.split(" ")[1];
      const accessToken = req.header("X-Access-Token")!;
      if (!refreshToken || !accessToken) {
        res.status(401);
        res.send({
          error: "Both refresh token and access token must be provided",
        });
        return;
      }
      try {
        const newAccessToken = await this.users.refresh(
          accessToken,
          refreshToken,
        );
        // res.send({})
        res.send({ accessToken: newAccessToken });
      } catch (e) {
        res.status(403)
        res.send({error: e.message})
      }
    });
  }

  router() {
    return this._router;
  }
}
