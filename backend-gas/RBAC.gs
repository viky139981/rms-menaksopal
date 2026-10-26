function permissionsForRole_(role) {
  return ROLE_PERMISSIONS[upper_(role)] || [];
}

function hasPermission_(user, permission) {
  const list = permissionsForRole_(user.Role);
  return list.includes('*') || list.includes(permission);
}

function requirePermission_(session, permission) {
  if (!session || !session.user) throw new Error('Session tidak valid.');
  if (!hasPermission_(session.user, permission)) throw new Error('Anda tidak memiliki hak akses untuk aksi ini.');
}
