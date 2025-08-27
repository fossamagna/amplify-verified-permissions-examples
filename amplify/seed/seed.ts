import { readFile } from "node:fs/promises";
import {
  //addToUserGroup,
  createAndSignUpUser,
  signInUser,
  getSecret,
} from "@aws-amplify/seed";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { type Schema } from "../data/resource";

const url = new URL("../../amplify_outputs.json", import.meta.url);
const outputs = JSON.parse(await readFile(url, { encoding: "utf8" }));

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function createAndSignInUser() {
  const username = await getSecret('username');
  const password = await getSecret('password');

  try {
    await createAndSignUpUser({
      username: username,
      password: password,
      signInFlow: 'Password',
      signInAfterCreation: true
    });
  } catch (err) {
    const error = err as Error;
    if (error.name === 'UsernameExistsError') {
      await signInUser({
        username: username,
        password: password,
        signInFlow: 'Password'
      });
    } else {
      throw err;
    }
  }
}

async function seed() {
  console.log("Seeding data...");

  await createAndSignInUser();

  // Create Project
  const { data: project } = await client.models.Project.create({
    name: "My First Project",
    description: "This is a sample project.",
  });

  if (!project) {
    console.error("Failed to create project.");
    return;
  }
  console.log("Created project:", project.id);

  // Create Folder
  const { data: folder } = await client.models.Folder.create({
    name: "Documents",
    projectId: project.id,
  });

  if (!folder) {
    console.error("Failed to create folder.");
    return;
  }
  console.log("Created folder:", folder.id);

  // Create Files
  await client.models.File.create({
    name: "README.md",
    content: "This is a sample README file.",
    projectId: project.id,
    folderId: folder.id,
  });

  await client.models.File.create({
    name: "hello.txt",
    content: "Hello, world!",
    projectId: project.id,
    folderId: folder.id,
  });

  console.log("Seeding complete.");
}

seed();
