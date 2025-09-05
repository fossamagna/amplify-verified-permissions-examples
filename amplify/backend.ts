import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { authz } from "./auth/authz";

const backend = defineBackend({
  auth,
  data,
});
authz(backend.data);