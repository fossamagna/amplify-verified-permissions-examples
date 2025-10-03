import type { Schema } from "../../../data/resource";

export type Member = {
  userId: string; // PK
  roleAndModel: string; // SK
  ids: string[];
};

export type Project = Pick<Schema["Project"]["type"], "id" | "name"> & {
  __typename: "Project";
};

export type Folder = Pick<Schema["Folder"]["type"], "id" | "projectId" | "name"> & {
  __typename: "Folder";
};

export type File = Pick<
  Schema["File"]["type"],
  "id" | "projectId" | "folderId" | "name"
  > & { __typename: "File" };