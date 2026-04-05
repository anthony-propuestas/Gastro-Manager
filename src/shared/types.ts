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
  my_role?: 'gerente' | 'owner';
};

export type NegocioMember = {
  user_id: string;
  user_email: string;
  user_name: string;
  invited_by: string;
  joined_at: string;
  negocio_role: 'gerente' | 'owner';
};

export type OwnerRequest = {
  id: number;
  negocio_id: number;
  user_id: string;
  user_name: string;
  user_email: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
};

export type NegocioModuleRestrictions = {
  calendario: boolean;
  personal: boolean;
  sueldos: boolean;
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

