import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  Project: a
    .model({
      name: a.string(),
      description: a.string(),
      // relations
      folders: a.hasMany("Folder", "projectId"),
      files: a.hasMany("File", "projectId"),
      members: a.hasMany("ProjectMember", "projectId"),
    })
    .authorization((allow) => [allow.authenticated()]),
  Folder: a
    .model({
      name: a.string(),
      // relations
      projectId: a.id(),
      project: a.belongsTo("Project", "projectId"),
      files: a.hasMany("File", "folderId"),
    })
    .authorization((allow) => [allow.authenticated()]),
  File: a
    .model({
      name: a.string(),
      content: a.string(),
      // relations
      folderId: a.id(),
      folder: a.belongsTo("Folder", "folderId"),
      projectId: a.id(),
      project: a.belongsTo("Project", "projectId"),
    })
    .authorization((allow) => [allow.authenticated()]),
  ProjectMember: a.model({
    userId: a.id().required(),
    projectId: a.id().required(),
    project: a.belongsTo("Project", "projectId"),
    role: a.ref("ProjectMemberRole"),
  })
    .identifier(["userId", "projectId"])
    .authorization((allow) => [allow.authenticated()]),
  ProjectMemberRole: a.enum(["OWNER", "CONTRIBUTOR", "VIEWER"]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
