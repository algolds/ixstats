/** Whether the user belongs to a thinktank (member, joiner, creator, or on its roster). */
export function isGroupMember(group: any, userId: string): boolean {
  return (
    Boolean(group.isMember) ||
    Boolean(group.isJoined) ||
    (Boolean(userId) &&
      (group.createdBy === userId || group.members?.some((m: any) => m.userId === userId)))
  );
}
