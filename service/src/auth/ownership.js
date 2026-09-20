function isOwner(principal, ownerSubject) {
  return Boolean(
    principal &&
    principal.subject &&
    principal.subject === ownerSubject
  );
}

function canAccessObject(principal, object) {
  if (!principal || !object) {
    return false;
  }

  if (principal.kind === 'job') {
    return true;
  }

  return isOwner(principal, object.ownerSubject);
}

module.exports = {
  isOwner,
  canAccessObject
};