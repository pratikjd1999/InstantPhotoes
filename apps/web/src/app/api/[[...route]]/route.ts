import { handle } from "hono/vercel";
import { api } from "@/server/api";

export const dynamic = "force-dynamic";

const handler = handle(api);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
