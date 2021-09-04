import { JoinStrategy } from "@lambda-team/ltdl/builders/joinBuilders/join";
import { AbstractTable } from "@lambda-team/ltdl/tables";
import { ExtractModel } from "@lambda-team/ltdl/tables/inferTypes";
import JWT, { JwtPayload } from "jsonwebtoken";
import { uuid } from "uuidv4";
import { ItemsTable } from "./items";
import { eq, to } from "@lambda-team/ltdl";

class UsersTable extends AbstractTable<UsersTable> {
  public static INSTANCE: UsersTable = new UsersTable({});

  public id = this.int("id").primaryKey().autoIncrement();
  public email = this.varchar("email", { size: 512 }).unique();
  public password = this.varchar("password", { size: 512 });

  public tableName(): string {
    return "users";
  }
}

type User = ExtractModel<UsersTable>;
type Item = ExtractModel<ItemsTable>;

class Users {
  private readonly secret = "lambdaauthsecret";

  constructor(private readonly table: UsersTable,
              private readonly itemsTable: ItemsTable) {
  }

  userWithItems = async (
    id: number,
  ): Promise<{ user: User; items: Item[] }> => {
    const joinQuery = to(this.itemsTable)
      .columns(this.itemsTable.ownerId, this.table.id)
      .joinStrategy(JoinStrategy.LEFT_JOIN);

    const query = this.table.select().where(eq(this.table.id, id)).join(
      joinQuery,
    );

    const result = (await query.execute()).mapByResult((user, item) => {
      return { user, item };
    });

    const res = result.reduce((prev, cur) => {
      prev[cur.user.id!!] = prev[cur.user.id!!] || { user: cur.user };
      prev[cur.user.id!!].items = [
        ...prev[cur.user.id!!].items || [],
        cur.item,
      ];
      return prev;
    }, {} as any);

    return res;
  };

  signup = async (email: string, password: string): Promise<User> => {
    const users = await this.table.select().where(eq(this.table.email, email))
      .all();
    if (users.length > 0) {
      throw new Error(`user with ${email} email already exists`);
    }

    return await this.table.insert({ email, password }).first();
  };

  verifyToken = (accessToken: string): boolean => {
    try {
      JWT.verify(accessToken, this.secret);
    } catch (e) {
      return false;
    }
    return true;
  };

  login = async (
    email: string,
    password: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const user = await this.table.select()
      .where(eq(this.table.email, email))
      .first();

    if (null === user) {
      throw new Error(`user with ${email} email does not exist`);
    }

    if (user.password !== password) {
      throw new Error(`password is wrong`);
    }

    const payload = {
      id: user.id,
      email: user.email,
    };

    // random int between [30 and 60]
    const lifetime = Math.floor(Math.random() * 31 + 30);
    const tokenId = uuid();

    const accessToken = JWT.sign(payload, this.secret, {
      jwtid: tokenId,
      expiresIn: lifetime,
      subject: "access",
    });

    const refreshToken = JWT.sign({}, this.secret, {
      jwtid: tokenId,
      subject: "refresh",
    });

    return { user, accessToken, refreshToken };
  };

  refresh = async (
    accessToken: string,
    refreshToken: string,
  ): Promise<String> => {
    const valid2 = JWT.verify(refreshToken, this.secret);
    if (!valid2) {
      throw new Error("Invalid tokens pair");
    }

    try {
      JWT.verify(accessToken, this.secret);
    } catch (e) {
      if (!(e instanceof JWT.TokenExpiredError)) {
        throw e;
      }
      console.log("expired");
    }

    const now = Math.floor(new Date().getTime() / 1000);

    const { id, email, exp, jti: jti1 } = JWT.decode(accessToken, {
      json: true,
    })! as JwtPayload;
    const { jti: jti2 } = JWT.decode(refreshToken)! as JwtPayload;

    console.log(exp, now);
    if (exp && exp > now) {
      throw new Error("Token is not yet expired");
    }

    if (!jti1 || !jti2 || jti1 !== jti2) {
      throw new Error("AccessToken does not match RefreshToken");
    }

    const lifetime = Math.floor(Math.random() * 31 + 30);

    const payload = {
      id: id,
      email: email,
    };
    console.log(jti1);

    const newAccessToken = JWT.sign(payload, this.secret, {
      jwtid: jti1,
      expiresIn: lifetime,
      subject: "access",
    });
    return newAccessToken;
  };
}

export { User, Users, UsersTable };
