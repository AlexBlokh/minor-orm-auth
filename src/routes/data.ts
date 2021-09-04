import { Users } from "../data/users";
import express, { RequestHandler, Router } from "express";

export default class DataController {
  private _router: Router;

  router() {
    return this._router;
  }

  constructor(
    users: Users,
    auther: RequestHandler,
  ) {
    this._router = express.Router();

    this._router.get("/me:num", auther, (req, res) => {
      console.log(req.params);
      const num = req.params.num;

      console.log(num);
      res.send({});
    });
  }
}
