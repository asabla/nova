import { Connection, Client } from "@temporalio/client";
import { env } from "./env";

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });
    client = new Client({ connection });
  }
  return client;
}
