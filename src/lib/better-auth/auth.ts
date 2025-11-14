import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import client from "./db";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL } from "../env";
import { createAuthMiddleware } from "better-auth/api";
import db from "../database/db";
import { Subscription } from "../database/schema/subscription.model";
import { ObjectId } from "mongodb";

const dbClient = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(dbClient),
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (c) => {
      const newSession = c.context.newSession;
      const user = newSession?.user;

      if (newSession && user) {
        try {
          await db();

          const isSubAvil = await Subscription.findOne({ subscriber: user.id });

          if (isSubAvil) {
            return;
          }

          const subs = await Subscription.create({
            subscriber: user.id,
            status: "activated",
          });

          const userCollection = dbClient.collection("user");

          await userCollection.updateOne(
            {
              _id: new ObjectId(subs.subscriber),
            },
            {
              $set: { subscription: subs._id },
            }
          );
        } catch (error) {
          console.log(
            "Error in creating subscription in auth before hook: ",
            error
          );

          throw c.redirect("/sign-in");
        }
      }
    }),
  },
  plugins: [nextCookies()],
});
