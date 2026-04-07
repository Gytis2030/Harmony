'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import type { ProjectRole } from '@/lib/project-members';

type ProjectMember = {
  userId: string;
  role: ProjectRole;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

type ProjectMembersPanelProps = {
  projectId: string;
  currentUserRole: ProjectRole;
  members: ProjectMember[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function ProjectMembersPanel({ projectId, currentUserRole, members }: ProjectMembersPanelProps) {
  const { notify } = useToast();
  const [memberList, setMemberList] = useState(members);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [roleSavingUserId, setRoleSavingUserId] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteMessage('Enter an email to invite.');
      notify('Enter an email to invite.', 'error');
      return;
    }

    setInviteBusy(true);
    setInviteMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error ?? 'Unable to invite member.';
        setInviteMessage(message);
        notify(message, 'error');
        return;
      }

      const member = payload.member as {
        user_id: string;
        role: ProjectRole;
        created_at: string;
        profiles?: { full_name: string | null; email: string | null } | null;
      };

      setMemberList((prev) => [
        ...prev,
        {
          userId: member.user_id,
          role: member.role,
          createdAt: member.created_at,
          fullName: member.profiles?.full_name ?? null,
          email: member.profiles?.email ?? null
        }
      ]);
      setInviteEmail('');
      setInviteRole('viewer');
      setInviteMessage('Member added to the project.');
      notify('Member added to the project.', 'success');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRoleChange = async (memberUserId: string, role: 'editor' | 'viewer') => {
    setRoleSavingUserId(memberUserId);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberUserId, role })
      });
      const payload = await response.json();

      if (!response.ok) {
        const message = payload.error ?? 'Failed to update role.';
        setInviteMessage(message);
        notify(message, 'error');
        return;
      }

      setMemberList((prev) => prev.map((member) => (member.userId === memberUserId ? { ...member, role } : member)));
      notify('Member role updated.', 'success');
    } finally {
      setRoleSavingUserId(null);
    }
  };

  return (
    <section className="card p-4">
      <h2 className="text-lg font-medium">Project members</h2>
      <p className="mt-1 text-xs text-muted">Owners and editors can make changes. Viewers can listen and review.</p>

      <ul className="mt-3 space-y-2">
        {memberList.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border bg-background p-3 text-sm text-muted">No members yet.</li>
        ) : null}
        {memberList.map((member) => {
          const displayName = member.fullName || member.email || 'Unknown user';
          const roleLocked = member.role === 'owner' || !isOwner;
          return (
            <li key={member.userId} className="rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{displayName}</p>
                  {member.email ? <p className="text-xs text-muted">{member.email}</p> : null}
                  <p className="text-xs text-muted">Joined {formatDate(member.createdAt)}</p>
                </div>
                {roleLocked ? (
                  <span className="rounded border border-border px-2 py-1 text-xs capitalize">{member.role}</span>
                ) : (
                  <label className="flex items-center gap-2 text-xs">
                    Role
                    <select
                      className="rounded border border-border bg-background px-2 py-1"
                      value={member.role}
                      disabled={roleSavingUserId === member.userId}
                      onChange={(event) => handleRoleChange(member.userId, event.target.value as 'editor' | 'viewer')}
                    >
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <h3 className="text-sm font-medium">Invite member</h3>
          <p className="mt-1 text-xs text-muted">For V1, invite by account email.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="rounded border border-border bg-background px-2 py-1 text-sm"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="collaborator@example.com"
            />
            <select className="rounded border border-border bg-background px-2 py-1 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'editor' | 'viewer')}>
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
            </select>
            <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white" onClick={handleInvite} disabled={inviteBusy}>
              {inviteBusy ? 'Inviting…' : 'Add member'}
            </button>
          </div>
          {inviteMessage ? <p className="mt-2 text-xs text-muted">{inviteMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
