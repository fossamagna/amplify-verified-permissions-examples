permit (
  principal,
  action in [
    AmplifyAVP::Action::"Query.getProject",
    AmplifyAVP::Action::"Query.getFolder",
    AmplifyAVP::Action::"Query.getFile",
    AmplifyAVP::Action::"Query.listFolders",
    AmplifyAVP::Action::"Query.listFiles",
    AmplifyAVP::Action::"Query.listProjectMembers"
  ],
  resource
)
when {
  resource in principal.viewerProjects
};
