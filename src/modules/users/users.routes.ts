/**
 * Users Routes
 * Hono route definitions for user endpoints
 *
 * All user routes require Supabase session authentication.
 */

import { Hono } from "hono";
import {
  createUserHandler,
  getMeHandler,
  getUserHandler,
  updateUserHandler,
} from "./users.controller";
import { sessionAuth } from "../../middleware/session.middleware";

const users = new Hono();

users.use("*", sessionAuth(true));

users.post("/users", createUserHandler);
users.get("/users/me", getMeHandler);
users.get("/users/:id", getUserHandler);
users.patch("/users/:id", updateUserHandler);

export { users as usersRoutes };
