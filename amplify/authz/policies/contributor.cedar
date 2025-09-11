permit (
  principal,
  action in [
    AmplifyAVP::Action::"getProject",
    AmplifyAVP::Action::"updateProject",
    AmplifyAVP::Action::"getFolder",
    AmplifyAVP::Action::"updateFolder",
    AmplifyAVP::Action::"getFile",
    AmplifyAVP::Action::"updateFile",
    AmplifyAVP::Action::"createFolder",
    AmplifyAVP::Action::"createFile",
    AmplifyAVP::Action::"createProjectMember",
    AmplifyAVP::Action::"updateProjectMember",
    AmplifyAVP::Action::"listProjects",
    AmplifyAVP::Action::"listFolders",
    AmplifyAVP::Action::"listFiles",
    AmplifyAVP::Action::"listProjectMembers"
  ],
  resource
)
when {
  resource in principal.contributorProjects
};
