'use client'

import { useActionState, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, Copy, Loader2, Pencil, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmAction } from '@/components/app/confirm-action'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useActionFeedback } from '@/hooks/use-action-feedback'
import { inviteMember, removeMember, revokeInvitation, toggleMember, updateMember } from './actions'

type RoleOpt = { id: string; name: string; key: string | null }

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant='outline'
      size='sm'
      onClick={async () => {
        await navigator.clipboard.writeText(value.startsWith('/') ? window.location.origin + value : value)
        setCopied(true)
        toast.success('Enlace copiado')
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />} Copiar enlace
    </Button>
  )
}

export function InviteDialog({ slug, roles }: { slug: string; roles: RoleOpt[] }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(inviteMember.bind(null, slug), null)
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state)
  const url = state?.ok ? state.data?.url : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='lg' />}>
        <UserPlus /> Invitar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar al equipo</DialogTitle>
          <DialogDescription>Se generará un enlace de invitación para compartir.</DialogDescription>
        </DialogHeader>
        {url ? (
          <div className='space-y-3'>
            <p className='text-xs text-muted-foreground'>Comparte este enlace con la persona invitada:</p>
            <code className='block rounded-md bg-muted p-2 text-[0.7rem] break-all'>{url}</code>
            <DialogFooter>
              <CopyButton value={url} />
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={action}>
            <FieldGroup>
              <Field data-invalid={!!errors?.email}>
                <FieldLabel htmlFor='inv-email'>Correo</FieldLabel>
                <Input id='inv-email' name='email' type='email' required autoFocus />
                <FieldError>{errors?.email?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor='inv-role'>Rol</FieldLabel>
                <NativeSelect id='inv-role' name='roleId' defaultValue={roles.find((r) => r.key === 'cashier')?.id}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
            <DialogFooter className='mt-6'>
              <Button type='submit' size='lg' disabled={pending}>
                {pending && <Loader2 className='animate-spin' />}
                Crear invitación
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function InvitationRow({
  slug,
  invitation,
}: {
  slug: string
  invitation: { id: string; email: string; role: string; token: string; expiresAt: string; expired: boolean }
}) {
  const url = `/invite/${invitation.token}`
  return (
    <div className='flex flex-wrap items-center gap-3 px-4 py-3'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>{invitation.email}</p>
        <p className='text-xs text-muted-foreground'>
          {invitation.role} ·{' '}
          {invitation.expired
            ? 'expirada'
            : `expira ${formatDistanceToNow(new Date(invitation.expiresAt), { locale: es, addSuffix: true })}`}
        </p>
      </div>
      {invitation.expired ? <StatusBadge tone='danger'>Expirada</StatusBadge> : <CopyButton value={url} />}
      <ConfirmAction
        title='¿Revocar invitación?'
        confirmLabel='Revocar'
        action={revokeInvitation.bind(null, slug, invitation.id)}
        trigger={<Button variant='ghost' size='sm'>Revocar</Button>}
      />
    </div>
  )
}

export function MemberActions({
  slug,
  member,
  roles,
  branches,
}: {
  slug: string
  member: {
    id: string
    name: string
    roleId: string
    branchId: string | null
    pin: string | null
    isActive: boolean
    isOwner: boolean
    isSelf: boolean
  }
  roles: RoleOpt[]
  branches: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(updateMember.bind(null, slug, member.id), null)
  const [toggling, start] = useTransition()
  const errors = state && !state.ok ? state.fieldErrors : undefined
  useActionFeedback(state, { onSuccess: () => setOpen(false) })

  return (
    <div className='flex items-center gap-0.5'>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant='ghost' size='icon' aria-label={`Editar a ${member.name}`} />}>
          <Pencil />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{member.name}</DialogTitle>
          </DialogHeader>
          <form action={action}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`m-role-${member.id}`}>Rol</FieldLabel>
                <NativeSelect id={`m-role-${member.id}`} name='roleId' defaultValue={member.roleId} disabled={member.isOwner}>
                  {roles
                    .filter((r) => member.isOwner || r.key !== 'owner')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </NativeSelect>
                {member.isOwner && <input type='hidden' name='roleId' value={member.roleId} />}
              </Field>
              <Field>
                <FieldLabel htmlFor={`m-branch-${member.id}`}>Sucursal predeterminada</FieldLabel>
                <NativeSelect id={`m-branch-${member.id}`} name='branchId' defaultValue={member.branchId ?? ''}>
                  <option value=''>Sin asignar</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={!!errors?.pin}>
                <FieldLabel htmlFor={`m-pin-${member.id}`}>PIN de cajero</FieldLabel>
                <Input id={`m-pin-${member.id}`} name='pin' inputMode='numeric' maxLength={6} defaultValue={member.pin ?? ''} />
                <FieldDescription>Opcional, 4 a 6 dígitos.</FieldDescription>
                <FieldError>{errors?.pin?.[0]}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter className='mt-6'>
              <Button type='submit' size='lg' disabled={pending}>
                {pending && <Loader2 className='animate-spin' />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {!member.isOwner && !member.isSelf && (
        <>
          <Button
            variant='ghost'
            size='sm'
            disabled={toggling}
            onClick={() =>
              start(async () => {
                const res = await toggleMember(slug, member.id)
                if (res.ok) toast.success(res.message ?? 'Listo')
                else toast.error(res.error)
              })
            }
          >
            {member.isActive ? 'Suspender' : 'Reactivar'}
          </Button>
          <ConfirmAction
            title={`¿Quitar a ${member.name} del negocio?`}
            description='Perderá el acceso de inmediato. Su historial de ventas se conserva.'
            confirmLabel='Quitar'
            action={removeMember.bind(null, slug, member.id)}
            trigger={
              <Button variant='ghost' size='icon' aria-label='Quitar miembro' className='text-muted-foreground hover:text-destructive'>
                <UserMinus />
              </Button>
            }
          />
        </>
      )}
    </div>
  )
}
