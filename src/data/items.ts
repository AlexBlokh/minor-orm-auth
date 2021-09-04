import { AbstractTable } from "@lambda-team/ltdl/tables";
import { ExtractModel } from "@lambda-team/ltdl/tables/inferTypes";
import { Users, UsersTable } from "./users";

class ItemsTable extends AbstractTable<ItemsTable> {
  // public static INSTANCE = new ItemsTable({});

  id = this.int("id").primaryKey().autoIncrement();
  name = this.varchar("name");
  ownerId = this.int("owner_id").foreignKey(UsersTable, (t) => t.id); // many to one relation

  tableName(): string {
    return "items";
  }
}

type Item = ExtractModel<ItemsTable>;

class Items {
  constructor(private readonly table: ItemsTable) {
  }

  async create(name: string, ownerId: number): Promise<Item> {
    const item = await this.table.insert({ name, ownerId }).first();
    return item;
  }
}

export { Items, ItemsTable };
