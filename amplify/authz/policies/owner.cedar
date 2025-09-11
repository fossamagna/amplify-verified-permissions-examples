permit (
  principal,
  action,
  resource
)
when {
  resource in principal.ownerProjects
};
