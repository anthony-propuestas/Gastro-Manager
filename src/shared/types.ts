/**
 * Types shared between the client and server go here.
 */

export type Negocio = {
  id: number;
  name: string;
  created_by: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
};

export type NegocioMember = {
  user_id: string;
  user_email: string;
  user_name: string;
  invited_by: string;
  joined_at: string;
};

export type Invitation = {
  token: string;
  expires_at: string;
  invite_url: string;
};

export type InvitationPreview = {
  negocio_name: string;
  invited_by_name: string;
  expires_at: string;
};

