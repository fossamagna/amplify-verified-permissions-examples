permit (
  principal,
  action in [
    AmplifyAVP::Action::"getProject",
    AmplifyAVP::Action::"getFolder",
    AmplifyAVP::Action::"getFile",
    AmplifyAVP::Action::"listFolders",
    AmplifyAVP::Action::"listFiles",
    AmplifyAVP::Action::"listProjectMembers"
  ],
  resource
)
when {
  resource in principal.viewerProjects
};
