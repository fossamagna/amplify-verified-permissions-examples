import type { Schema } from "../../../data/resource";

export type ProjectMember = {
  userId: string; // PK
  projectId: string; // SK
  role: string;
};

export type Project = Pick<Schema["Project"]["type"], "id" | "name"> & {
  ___typename: "Project";
};

export type Folder = Pick<Schema["Folder"]["type"], "id" | "projectId" | "name"> & {
  ___typename: "Folder";
};

export type File = Pick<
  Schema["File"]["type"],
  "id" | "projectId" | "folderId" | "name"
  > & { ___typename: "File" };