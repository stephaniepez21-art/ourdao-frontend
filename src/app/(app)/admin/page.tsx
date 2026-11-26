'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ShieldCheckIcon,
  UsersIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlayIcon,
  TrashIcon,
} from '@/lib/icons'
import {
  useUserData,
  useDAOStats,
  useAdmins,
  useAdminActions,
  useAdminLog,
  useAuditLog,
  useFailedEvents,
  usePauserActions,
  usePolicyUpdateActions,
  usePendingPolicyUpdate,
  useRawLoanPolicy,
  useTokenWhitelist,
  useReEvaluateFailedEvent,
  useBatchResolveFailedEvents,
} from '@/hooks/useDAO'
import type { FailedEventResolution } from '@/lib/backend'
import { useAdminAuditLog } from '@/hooks/use-admin-audit-log'
import { AddressLink } from '@/components/AddressLink'
import { LoadError } from '@/components/LoadError'
import { useAnnounceLoad } from '@/lib/useAnnounceLoad'
import { formatToken, formatDate, formatThreshold } from '@/lib/utils'
import { formatStellarAddress, isStellarAddress } from '@/lib/stellar'
import { LoadingSpinner } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/ui/stat-card'
import { useNow } from '@/hooks/useNow'
import type { LoanPolicy } from '@/lib/dao-client'

type Tab = 'overview' | 'governance' | 'policy' | 'activity' | 'audit' | 'quarantined'

const TABS: { id: Tab; name: string; icon: ReactNode }[] = [
  { id: 'overview', name: 'Overview', icon: <ChartBarIcon className="h-4 w-4" /> },
  { id: 'governance', name: 'Governance', icon: <UsersIcon className="h-4 w-4" /> },
  { id: 'policy', name: 'Policy & Pauser', icon: <ShieldCheckIcon className="h-4 w-4" /> },
  { id: 'activity', name: 'Activity Log', icon: <ClockIcon className="h-4 w-4" /> },
  { id: 'audit', name: 'Audit', icon: <ClockIcon className="h-4 w-4" /> },
  {
    id: 'quarantined',
    name: 'Quarantined Events',
    icon: <ExclamationTriangleIcon className="h-4 w-4" />,
  },
]

export default function AdminPage() {
  const userData = useUserData()
  const stats = useDAOStats()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!userData.isConnected) {
    return (
      <GuardMessage
        icon={
          <ExclamationTriangleIcon className="mx-auto mb-4 h-12 w-12 text-yellow-500 dark:text-yellow-400" />
        }
        title="Wallet Not Connected"
        message="Please connect your wallet to access the admin panel."
      />
    )
  }

  if (userData.isLoading) {
    // Same "not yet known" collapse as isMember (#69) — isAdmin reads false
    // until the query resolves, which would otherwise flash "Access Denied"
    // at real admins on every load. No AppShell wrapper needed — the (app)
    // route-group layout already provides it.
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (userData.isError) {
    // isAdmin reads false when the read fails — "Access Denied" would be a lie.
    return (
      <div className="mx-auto mt-8 max-w-md">
        <LoadError what="your admin status" onRetry={userData.refetch} />
      </div>
    )
  }

  if (!userData.isAdmin) {
    return (
      <GuardMessage
        icon={
          <ExclamationTriangleIcon className="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400" />
        }
        title="Access Denied"
        message="You need admin privileges to access this panel."
      />
    )
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Real-time DAO governance and system state." />
      {stats.quarantinedEvents > 0 ? (
        <div className="mx-auto mb-6 flex max-w-7xl items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Warning:</span> {stats.quarantinedEvents} quarantined
            event(s) detected. Handlers failed to process these events; some indexer data may be
            delayed or incomplete. Check the <strong>Quarantined Events</strong> tab for details.
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl">
        <div className="bg-card border-border rounded-lg border shadow">
          <div className="border-border border-b">
            <nav className="flex space-x-8 px-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 border-b-2 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab stats={stats} />}
            {activeTab === 'governance' && <GovernanceTab stats={stats} />}
            {activeTab === 'policy' && <PolicyPauserTab />}
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'quarantined' && <QuarantinedEventsTab />}
          </div>
        </div>
      </div>
    </>
  )
}

function GuardMessage({
  icon,
  title,
  message,
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="bg-card rounded-lg p-6 text-center">
        {icon}
        <h2 className="text-foreground mb-2 text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

function OverviewTab({ stats }: { stats: ReturnType<typeof useDAOStats> }) {
  const { pause, unpause, isPending } = useAdminActions()

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-6 ${
          stats.isPaused
            ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
            : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-full p-2 ${stats.isPaused ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}
            >
              <ShieldCheckIcon
                className={`h-6 w-6 ${stats.isPaused ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
              />
            </div>
            <div>
              <h3
                className={`text-lg font-semibold ${stats.isPaused ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}
              >
                Contract is {stats.isPaused ? 'Paused' : 'Active'}
              </h3>
              <p
                className={`text-sm ${stats.isPaused ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
              >
                {stats.isPaused
                  ? 'All state-changing operations are currently blocked on-chain.'
                  : 'Members can register, vote, and transact normally.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (stats.isPaused) {
                if (
                  !window.confirm(
                    'Unpause the DAO? This will re-enable all state-changing operations for every member.'
                  )
                )
                  return
                unpause().catch(() => {})
              } else {
                if (
                  !window.confirm(
                    'Pause the DAO? This will halt new loans, votes, and proposals for every member immediately.'
                  )
                )
                  return
                pause().catch(() => {})
              }
            }}
            disabled={isPending}
            className={`flex items-center space-x-2 rounded-md px-4 py-2 text-white disabled:opacity-50 ${
              stats.isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {stats.isPaused ? (
              <PlayIcon className="h-4 w-4" />
            ) : (
              <ExclamationTriangleIcon className="h-4 w-4" />
            )}
            <span>{stats.isPaused ? 'Unpause' : 'Pause'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Members"
          value={stats.activeMembers.toLocaleString()}
          sub={`${stats.totalMembers} total ever joined`}
        />
        <StatCard
          label="Active Loans"
          value={stats.activeLoans.toLocaleString()}
          sub={`${stats.totalLoans} total`}
        />
        <StatCard label="Treasury Balance" value={formatToken(stats.treasuryBalance)} />
        <StatCard label="Consensus Threshold" value={formatThreshold(stats.consensusThreshold)} />
      </div>
    </div>
  )
}

function GovernanceTab({ stats }: { stats: ReturnType<typeof useDAOStats> }) {
  const { admins, isLoading, isError: adminsError, refetch } = useAdmins()
  const { addAdmin, removeAdmin, setThreshold, isPending, isSuccess } = useAdminActions()
  const [newAdmin, setNewAdmin] = useState('')
  const [threshold, setThresholdInput] = useState('')

  // Same class of input as the governance proposal form's destination
  // address, validated against the same shared predicate before a
  // transaction is ever built — granting admin rights is among the
  // highest-stakes actions in the app and deserves at least what the
  // withdrawal-adjacent form already has (#66).
  const trimmedNewAdmin = newAdmin.trim()
  const newAdminError = trimmedNewAdmin.length > 0 && !isStellarAddress(trimmedNewAdmin)

  const submitAddAdmin = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmedNewAdmin || !isStellarAddress(trimmedNewAdmin)) return
    if (
      !window.confirm(
        `Add ${formatStellarAddress(trimmedNewAdmin)} as an admin? This grants full admin privileges.`
      )
    )
      return
    // `run` already toasted the failure; it rethrows for callers that need to
    // react, but a form handler has nothing to add, so swallow it here (#316).
    try {
      await addAdmin(trimmedNewAdmin)
    } catch {
      return
    }
    setNewAdmin('')
    refetch()
  }

  const submitThreshold = async (e: FormEvent) => {
    e.preventDefault()
    const bps = Number(threshold)
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10_000) return
    if (
      !window.confirm(
        `Update consensus threshold from ${formatThreshold(stats.consensusThreshold)} to ${formatThreshold(bps)}? This changes the approval bar for every open proposal.`
      )
    )
      return
    try {
      await setThreshold(bps)
    } catch {
      return
    }
    setThresholdInput('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Admins ({admins.length})</h3>
        </div>
        <div className="divide-border divide-y">
          {isLoading && <div className="text-muted-foreground px-6 py-4 text-sm">Loading…</div>}
          {adminsError && (
            <LoadError what="the admin list" onRetry={() => void refetch()} className="m-4" />
          )}
          {admins.map((addr) => (
            <div key={addr} className="flex items-center justify-between px-6 py-3">
              <AddressLink address={addr} className="text-foreground text-sm" />
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Remove admin ${formatStellarAddress(addr)}? This action requires a remaining admin to re-add them.`
                    )
                  )
                    return
                  try {
                    await removeAdmin(addr)
                  } catch {
                    return
                  }
                  refetch()
                }}
                disabled={isPending || admins.length <= 1}
                title={admins.length <= 1 ? 'Cannot remove the last admin' : 'Remove admin'}
                className="flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:text-red-300"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={submitAddAdmin}
          className="border-border flex items-start space-x-2 border-t p-6"
        >
          <div className="flex-1">
            <input
              type="text"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              placeholder="G… address to add as admin"
              aria-label="Address to add as admin"
              aria-invalid={newAdminError}
              aria-describedby={newAdminError ? 'new-admin-error' : undefined}
              className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {newAdminError && (
              <p id="new-admin-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                Enter a valid Stellar destination address (G… or C…)
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || !trimmedNewAdmin || !isStellarAddress(trimmedNewAdmin)}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Add Admin
          </button>
        </form>
      </div>

      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Consensus Threshold</h3>
          <p className="text-muted-foreground text-sm">
            Currently {formatThreshold(stats.consensusThreshold)} of active members, in basis
            points.
          </p>
        </div>
        <form onSubmit={submitThreshold} className="flex space-x-2 p-6">
          <input
            type="number"
            min={1}
            max={10_000}
            value={threshold}
            onChange={(e) => setThresholdInput(e.target.value)}
            aria-label="Consensus threshold in basis points"
            placeholder="e.g. 5100 for 51%"
            className="border-input dark:bg-muted dark:text-foreground flex-1 rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !threshold}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Update Threshold
          </button>
        </form>
        {isSuccess && (
          <p className="px-6 pb-4 text-sm text-green-600 dark:text-green-400">Updated.</p>
        )}
      </div>
    </div>
  )
}

function PolicyPauserTab() {
  const { setPauser, revokePauser, isPending: pauserPending } = usePauserActions()
  const {
    proposePolicyUpdate,
    executePolicyUpdate,
    cancelPolicyUpdate,
    isPending: policyPending,
  } = usePolicyUpdateActions()
  const [pauserAddr, setPauserAddr] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [interestBps, setInterestBps] = useState('')
  const [maxDuration, setMaxDuration] = useState('')

  const submitSetPauser = async (e: FormEvent) => {
    e.preventDefault()
    const addr = pauserAddr.trim()
    if (!addr) return
    if (!window.confirm(`Grant pause rights to ${addr}?`)) return
    try {
      await setPauser(addr)
    } catch {
      return
    }
    setPauserAddr('')
  }

  const submitRevokePauser = async () => {
    if (!window.confirm('Revoke the current pauser role?')) return
    try {
      await revokePauser()
    } catch {
      return
    }
  }

  const submitPropose = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(maxAmount)
    const bps = Number(interestBps)
    const dur = Number(maxDuration)
    if (!amount || !bps || !dur) return
    if (
      !window.confirm(
        `Propose policy update: max loan ${amount}, interest ${bps} bps, duration ${dur} ledgers?`
      )
    )
      return
    try {
      await proposePolicyUpdate({
        max_loan_amount: BigInt(amount),
        interest_rate_bps: bps,
        max_loan_duration_ledgers: dur,
      } as unknown as LoanPolicy)
    } catch {
      return
    }
    setMaxAmount('')
    setInterestBps('')
    setMaxDuration('')
  }

  return (
    <div className="space-y-6">
      {/* Pauser role */}
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Pauser Role</h3>
          <p className="text-muted-foreground text-sm">
            Grant or revoke the right to pause the DAO without full admin privileges.
          </p>
        </div>
        <form onSubmit={submitSetPauser} className="flex items-start space-x-2 p-6">
          <input
            type="text"
            value={pauserAddr}
            onChange={(e) => setPauserAddr(e.target.value)}
            placeholder="G… address to grant pauser role"
            aria-label="Pauser address"
            className="border-input dark:bg-muted dark:text-foreground flex-1 rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pauserPending || !pauserAddr.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Set Pauser
          </button>
        </form>
        <div className="px-6 pb-6">
          <button
            onClick={submitRevokePauser}
            disabled={pauserPending}
            className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Revoke Pauser
          </button>
        </div>
      </div>

      {/* Policy update flow */}
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Loan Policy Update</h3>
          <p className="text-muted-foreground text-sm">
            Propose, execute, or cancel the governed policy-update flow.
          </p>
        </div>
        <form onSubmit={submitPropose} className="space-y-3 p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="policy-max-amount"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Max Loan Amount
              </label>
              <input
                id="policy-max-amount"
                type="number"
                min={1}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="stroops"
                aria-label="Max loan amount in stroops"
                className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="policy-interest-rate"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Interest Rate (bps)
              </label>
              <input
                id="policy-interest-rate"
                type="number"
                min={1}
                max={10000}
                value={interestBps}
                onChange={(e) => setInterestBps(e.target.value)}
                placeholder="e.g. 500 = 5%"
                aria-label="Interest rate in basis points"
                className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="policy-max-duration"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Max Duration (ledgers)
              </label>
              <input
                id="policy-max-duration"
                type="number"
                min={1}
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                placeholder="ledgers"
                aria-label="Max loan duration in ledgers"
                className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={policyPending || !maxAmount || !interestBps || !maxDuration}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Propose Update
          </button>
        </form>
        <div className="flex space-x-3 px-6 pb-6">
          <button
            onClick={async () => {
              if (!window.confirm('Execute the pending policy update?')) return
              try {
                await executePolicyUpdate()
              } catch {
                return
              }
            }}
            disabled={policyPending}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Execute Update
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Cancel the pending policy update?')) return
              try {
                await cancelPolicyUpdate()
              } catch {
                return
              }
            }}
            disabled={policyPending}
            className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Update
          </button>
        </div>
      </div>

      <PendingPolicyUpdatePanel />
      <PauserSection />
      <TokenWhitelistSection />
    </div>
  )
}

/** Pauser assignment controls (#629). The pauser can pause but only an admin
 *  can unpause (per the contract CHANGELOG, #319). */
function PauserSection() {
  const { setPauser, revokePauser, isPending } = usePauserActions()
  const [pauserAddr, setPauserAddr] = useState('')

  const trimmed = pauserAddr.trim()
  const addrError = trimmed.length > 0 && !isStellarAddress(trimmed)

  const submitSetPauser = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || !isStellarAddress(trimmed)) return
    if (
      !window.confirm(
        `Set ${formatStellarAddress(trimmed)} as the pauser? They will be able to pause the DAO, but only an admin can unpause it.`
      )
    )
      return
    try {
      await setPauser(trimmed)
    } catch {
      return
    }
    setPauserAddr('')
  }

  const submitRevoke = async () => {
    if (
      !window.confirm(
        'Revoke the pauser role? The current pauser will no longer be able to pause the DAO. Only an admin can pause it afterwards.'
      )
    )
      return
    try {
      await revokePauser()
    } catch {
      return
    }
  }

  return (
    <div className="bg-card border-border mt-6 rounded-lg border">
      <div className="border-border border-b px-6 py-4">
        <h3 className="text-foreground text-lg font-semibold">Pauser Role</h3>
        <p className="text-muted-foreground text-sm">
          Assign an address that may pause the DAO. Only an admin can unpause it.
        </p>
      </div>
      <form onSubmit={submitSetPauser} className="flex items-start space-x-2 p-6">
        <div className="flex-1">
          <label
            htmlFor="pauser-address"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Pauser address
          </label>
          <input
            id="pauser-address"
            type="text"
            value={pauserAddr}
            onChange={(e) => setPauserAddr(e.target.value)}
            placeholder="G… address to set as pauser"
            aria-label="Address to set as pauser"
            aria-invalid={addrError}
            aria-describedby={addrError ? 'pauser-addr-error' : undefined}
            className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {addrError && (
            <p id="pauser-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar address (G… or C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !trimmed || !isStellarAddress(trimmed)}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Set Pauser
        </button>
      </form>
      <div className="px-6 pb-6">
        <button
          onClick={() => void submitRevoke()}
          disabled={isPending}
          className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          Revoke Pauser
        </button>
      </div>
    </div>
  )
}

/** Token whitelist controls (#623). Propose starts a 48 h timelock; execute
 *  finalizes the addition once it expires; remove is immediate. */
function TokenWhitelistSection() {
  const { proposeTokenAddition, executeTokenAddition, removeToken, isPending } = useTokenWhitelist()
  const [tokenAddr, setTokenAddr] = useState('')
  const [executeAddr, setExecuteAddr] = useState('')
  const [removeAddr, setRemoveAddr] = useState('')

  const trimmed = tokenAddr.trim()
  const executeTrimmed = executeAddr.trim()
  const removeTrimmed = removeAddr.trim()
  const addrError = trimmed.length > 0 && !isStellarAddress(trimmed)
  const executeError = executeTrimmed.length > 0 && !isStellarAddress(executeTrimmed)
  const removeError = removeTrimmed.length > 0 && !isStellarAddress(removeTrimmed)

  const submitPropose = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || !isStellarAddress(trimmed)) return
    try {
      await proposeTokenAddition(trimmed)
    } catch {
      return
    }
    setTokenAddr('')
  }

  const submitExecute = async (e: FormEvent) => {
    e.preventDefault()
    if (!executeTrimmed || !isStellarAddress(executeTrimmed)) return
    try {
      await executeTokenAddition(executeTrimmed)
    } catch {
      return
    }
    setExecuteAddr('')
  }

  const submitRemove = async (e: FormEvent) => {
    e.preventDefault()
    if (!removeTrimmed || !isStellarAddress(removeTrimmed)) return
    if (!window.confirm(`Remove ${formatStellarAddress(removeTrimmed)} from the whitelist?`)) return
    try {
      await removeToken(removeTrimmed)
    } catch {
      return
    }
    setRemoveAddr('')
  }

  return (
    <div className="bg-card border-border mt-6 rounded-lg border">
      <div className="border-border border-b px-6 py-4">
        <h3 className="text-foreground text-lg font-semibold">Token Whitelist</h3>
        <p className="text-muted-foreground text-sm">
          Propose, execute, and remove the tokens the DAO accepts.
        </p>
      </div>

      {/* Propose addition form */}
      <form
        onSubmit={submitPropose}
        className="border-border flex items-start space-x-2 border-t p-6"
      >
        <div className="flex-1">
          <label
            htmlFor="propose-token-address"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Propose token addition
          </label>
          <input
            id="propose-token-address"
            type="text"
            value={tokenAddr}
            onChange={(e) => setTokenAddr(e.target.value)}
            placeholder="Token contract address (C…)"
            aria-label="Token address to propose"
            aria-invalid={addrError}
            aria-describedby={addrError ? 'token-addr-error' : undefined}
            className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {addrError && (
            <p id="token-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar contract address (C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !trimmed || !isStellarAddress(trimmed)}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Propose
        </button>
      </form>

      {/* Execute addition form */}
      <form onSubmit={submitExecute} className="flex items-start space-x-2 p-6 pt-0">
        <div className="flex-1">
          <label
            htmlFor="execute-token-address"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Execute token addition
          </label>
          <p className="text-muted-foreground mb-1 text-xs">
            Available 48 hours after the proposal. Enter the same token address you proposed.
          </p>
          <input
            id="execute-token-address"
            type="text"
            value={executeAddr}
            onChange={(e) => setExecuteAddr(e.target.value)}
            placeholder="Token contract address (C…)"
            aria-label="Token address to execute"
            aria-invalid={executeError}
            aria-describedby={executeError ? 'execute-addr-error' : undefined}
            className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {executeError && (
            <p id="execute-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar contract address (C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !executeTrimmed || !isStellarAddress(executeTrimmed)}
          className="mt-6 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
        >
          Execute
        </button>
      </form>

      {/* Remove form */}
      <form
        onSubmit={submitRemove}
        className="border-border flex items-start space-x-2 border-t p-6"
      >
        <div className="flex-1">
          <label
            htmlFor="remove-token-address"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Remove token
          </label>
          <input
            id="remove-token-address"
            type="text"
            value={removeAddr}
            onChange={(e) => setRemoveAddr(e.target.value)}
            placeholder="Token contract address (C…)"
            aria-label="Token address to remove"
            aria-invalid={removeError}
            aria-describedby={removeError ? 'remove-addr-error' : undefined}
            className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {removeError && (
            <p id="remove-addr-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              Enter a valid Stellar contract address (C…)
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !removeTrimmed || !isStellarAddress(removeTrimmed)}
          className="mt-6 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          Remove
        </button>
      </form>
    </div>
  )
}

function ActivityTab() {
  const { entries, isLoading, isError, refetch } = useAdminLog(100)
  const {
    entries: auditEntries,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useAuditLog(100)
  useAnnounceLoad('Admin event history', isLoading, isError)

  return (
    <div className="space-y-6">
      {/* Backend audit log (#555) — records admin actions like pause/unpause,
          admin add/remove, threshold changes, reorg clears. */}
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Admin Audit Log</h3>
          <p className="text-muted-foreground text-sm">
            Backend-recorded admin actions: pause/unpause, admin changes, threshold updates, reorg
            clears, re-evaluations.
          </p>
        </div>
        <div className="divide-border divide-y">
          {auditLoading && (
            <div className="text-muted-foreground px-6 py-4 text-sm">Loading audit log…</div>
          )}
          {auditError && (
            <LoadError what="the audit log" onRetry={() => void refetchAudit()} className="m-4" />
          )}
          {!auditLoading && !auditError && auditEntries.length === 0 && (
            <div className="text-muted-foreground px-6 py-8 text-center">
              No admin audit log entries yet.
            </div>
          )}
          {auditEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center space-x-3">
                <span className="bg-muted text-foreground rounded px-2 py-1 font-mono text-xs">
                  {entry.action}
                </span>
                {entry.actor && (
                  <span className="text-muted-foreground text-sm">
                    {formatStellarAddress(entry.actor)}
                  </span>
                )}
                {entry.ledger != null && (
                  <span className="text-muted-foreground text-sm">Ledger {entry.ledger}</span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{formatDate(entry.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indexed on-chain event history */}
      <div className="bg-card border-border rounded-lg border">
        <div className="border-border border-b px-6 py-4">
          <h3 className="text-foreground text-lg font-semibold">Admin/Governance Event History</h3>
          <p className="text-muted-foreground text-sm">
            Indexed on-chain events: admin add/remove, threshold and policy changes, pause/unpause.
          </p>
        </div>
        <div className="divide-border divide-y">
          {isLoading && <div className="text-muted-foreground px-6 py-4 text-sm">Loading…</div>}
          {isError && (
            <LoadError
              what="the admin event history"
              onRetry={() => void refetch()}
              className="m-4"
            />
          )}
          {!isLoading && !isError && entries.length === 0 && (
            <div className="text-muted-foreground px-6 py-8 text-center">
              No admin/governance events indexed yet.
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center space-x-3">
                <span className="bg-muted text-foreground rounded px-2 py-1 font-mono text-xs">
                  {entry.symbol}
                </span>
                <span className="text-foreground text-sm">Ledger {entry.ledger}</span>
              </div>
              <span className="text-muted-foreground text-xs">{formatDate(entry.closedAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuditTab() {
  const { entries, loading, error, hasMore, loadMore, refetch } = useAdminAuditLog(10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Audit Log</h3>
          <p className="text-muted-foreground text-sm">
            Review administrative actions performed across the protocol.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="border-border bg-muted text-foreground hover:bg-accent rounded border px-4 py-2 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">
                Action
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Actor
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Target
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {loading && entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-6 py-8 text-center">
                  Loading audit log...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-red-500">
                  Error: {error}
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-6 py-8 text-center">
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr key={entry.id ?? idx} className="hover:bg-muted/30">
                  <td className="text-foreground px-6 py-4 font-medium">{entry.action}</td>
                  <td className="text-muted-foreground px-6 py-4 font-mono text-xs">
                    {entry.actor}
                  </td>
                  <td className="text-muted-foreground px-6 py-4 font-mono text-xs">
                    {entry.target || '—'}
                  </td>
                  <td className="text-muted-foreground px-6 py-4">
                    {typeof entry.timestamp === 'number'
                      ? new Date(entry.timestamp * 1000).toLocaleString()
                      : String(entry.timestamp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => loadMore()}
            disabled={loading}
            className="bg-muted text-foreground hover:bg-accent rounded px-6 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

function QuarantinedEventsTab() {
  const { failedEvents, isLoading, isError, refetch } = useFailedEvents()
  const {
    reEvaluate,
    isPending: isReEvaluating,
    error: reEvaluateError,
    result: reEvaluateResult,
  } = useReEvaluateFailedEvent()
  const {
    batchResolve,
    isPending: isResolving,
    error: batchError,
    result: batchResult,
  } = useBatchResolveFailedEvents()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [resolution, setResolution] = useState<FailedEventResolution | ''>('')
  const [note, setNote] = useState('')

  const numericIds = failedEvents
    .map((ev) => Number(ev.id))
    .filter((id) => Number.isInteger(id) && id > 0)
  const allSelected = numericIds.length > 0 && numericIds.every((id) => selectedIds.includes(id))
  const isBusy = isReEvaluating || isResolving

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : numericIds)
  }
  const toggleOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    )
  }

  const submitBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!resolution || selectedIds.length === 0) return
    const message = `Resolve ${selectedIds.length} selected quarantined event(s) as ${resolution}?`
    if (!window.confirm(message)) return
    const outcome = await batchResolve({
      ids: selectedIds,
      resolution,
      note: note.trim() || undefined,
    })
    if (outcome) {
      setSelectedIds([])
      setResolution('')
      setNote('')
    }
  }

  return (
    <div className="bg-card border-border rounded-lg border">
      <div className="border-border border-b px-6 py-4">
        <h3 className="text-foreground text-lg font-semibold">Quarantined / Failed Events</h3>
        <p className="text-muted-foreground text-sm">
          Events that failed indexer handler processing and are quarantined for investigation.
        </p>
      </div>

      <form
        onSubmit={submitBatch}
        className="border-border flex flex-wrap items-end gap-3 border-b p-6"
      >
        <fieldset>
          <legend className="text-foreground mb-1 block text-sm font-medium">Resolution</legend>
          <div className="flex items-center gap-4 py-2">
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quarantine-resolution"
                value="resolved"
                checked={resolution === 'resolved'}
                onChange={() => setResolution('resolved')}
                className="h-4 w-4"
              />
              resolved
            </label>
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quarantine-resolution"
                value="ignored"
                checked={resolution === 'ignored'}
                onChange={() => setResolution('ignored')}
                className="h-4 w-4"
              />
              ignored
            </label>
          </div>
        </fieldset>
        <div className="min-w-48 flex-1">
          <label
            htmlFor="quarantine-note"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Note (optional)
          </label>
          <input
            id="quarantine-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why these events are being resolved"
            className="border-input dark:bg-muted dark:text-foreground w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isBusy || !resolution || selectedIds.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Resolve selected
        </button>
      </form>

      {(reEvaluateError || batchError) && (
        <p role="alert" className="px-6 py-3 text-sm text-red-600 dark:text-red-400">
          {reEvaluateError ?? batchError}
        </p>
      )}
      {(reEvaluateResult || batchResult) && (
        <p role="status" className="text-muted-foreground px-6 py-3 text-sm">
          {reEvaluateResult ? (
            <>
              Event {reEvaluateResult.eventId}:{' '}
              <span>
                {reEvaluateResult.status === 'still_failing'
                  ? 'Still failing'
                  : reEvaluateResult.status === 'resolved'
                    ? 'Resolved'
                    : reEvaluateResult.status === 'ignored'
                      ? 'Ignored'
                      : reEvaluateResult.status}
              </span>
            </>
          ) : (
            `Resolved ${batchResult?.resolved ?? 0} event(s)`
          )}
        </p>
      )}

      <div className="border-border flex items-center gap-2 border-b px-6 py-3">
        <input
          id="select-all-events"
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          disabled={numericIds.length === 0 || isBusy}
          className="border-input h-4 w-4 rounded"
        />
        <label htmlFor="select-all-events" className="text-foreground text-sm">
          Select all
        </label>
      </div>

      <div className="divide-border divide-y">
        {isLoading && (
          <div className="text-muted-foreground px-6 py-4 text-sm">Loading quarantined events…</div>
        )}
        {isError && (
          <LoadError what="quarantined events" onRetry={() => void refetch()} className="m-4" />
        )}
        {!isLoading && !isError && failedEvents.length === 0 && (
          <div className="text-muted-foreground px-6 py-8 text-center">
            No quarantined events found. All handlers operating cleanly.
          </div>
        )}
        {failedEvents.map((ev) => (
          <div key={ev.id} className="flex flex-col gap-1 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(Number(ev.id))}
                  onChange={() => toggleOne(Number(ev.id))}
                  disabled={!Number.isInteger(Number(ev.id)) || Number(ev.id) <= 0 || isBusy}
                  aria-label={`Select event ${ev.id}`}
                  className="border-input h-4 w-4 rounded"
                />
                <span className="rounded bg-red-100 px-2 py-1 font-mono text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {ev.symbol}
                </span>
                <span className="text-foreground text-sm font-medium">Ledger #{ev.ledger}</span>
                {ev.retry_count !== undefined && (
                  <span className="text-muted-foreground text-xs">Retries: {ev.retry_count}</span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{formatDate(ev.created_at)}</span>
            </div>
            <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {ev.error}
            </div>
            <button
              type="button"
              onClick={() => void reEvaluate(ev.id)}
              disabled={isBusy}
              aria-label={`Re-evaluate event ${ev.id}`}
              className="border-input text-foreground hover:bg-accent mt-1 self-start rounded border px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              Re-evaluate
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Every LoanPolicy field, in the order the contract stores them. Units follow
// the contract: basis points (bps), seconds (s), or stroops for the membership fee.
const POLICY_FIELDS: { key: keyof LoanPolicy; label: string }[] = [
  { key: 'min_interest_rate', label: 'Min interest rate (bps)' },
  { key: 'max_interest_rate', label: 'Max interest rate (bps)' },
  { key: 'max_loan_duration', label: 'Max loan duration (s)' },
  { key: 'max_loan_to_treasury_ratio', label: 'Max loan to treasury ratio (bps)' },
  { key: 'membership_contribution', label: 'Membership contribution (stroops)' },
  { key: 'min_membership_duration', label: 'Min membership duration (s)' },
  { key: 'cooldown_period', label: 'Cooldown period (s)' },
  { key: 'editing_period', label: 'Editing period (s)' },
  { key: 'voting_period', label: 'Voting period (s)' },
  { key: 'quorum_bps', label: 'Quorum (bps)' },
  { key: 'default_grace_period', label: 'Default grace period (s)' },
  { key: 'default_penalty_bps', label: 'Default penalty (bps)' },
]

function formatPolicyValue(value: unknown): string {
  return value === undefined || value === null ? '—' : String(value)
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'Ready to execute'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days === 0 && hours === 0 && minutes === 0) return 'Executable in less than a minute'
  return `Executable in ${days}d ${hours}h ${minutes}m`
}

/** Shows a queued policy change beside the live values. Renders nothing when no
 *  update is pending. Changed fields are marked in text, not only by colour. */
function PendingPolicyUpdatePanel() {
  const { pending } = usePendingPolicyUpdate()
  const current = useRawLoanPolicy()
  const nowMs = useNow()
  const { executePolicyUpdate, cancelPolicyUpdate, isPending: busy } = usePolicyUpdateActions()

  if (!pending) return null

  const nowSec = nowMs == null ? null : Math.floor(nowMs / 1000)
  const timeLeft =
    nowSec == null ? 'Checking time left…' : formatTimeLeft(pending.executionTime - nowSec)
  const ready = nowSec != null && nowSec >= pending.executionTime

  const onExecute = async () => {
    if (!ready) return
    if (
      !window.confirm(
        'Execute the pending policy update? The new loan policy applies to every member immediately.'
      )
    )
      return
    try {
      await executePolicyUpdate()
    } catch {
      // `run` has already shown the failure; nothing more to do here.
    }
  }

  const onCancel = async () => {
    if (!window.confirm('Cancel the pending policy update? Its proposed values will be discarded.'))
      return
    try {
      await cancelPolicyUpdate()
    } catch {
      // `run` has already shown the failure; nothing more to do here.
    }
  }

  return (
    <section
      aria-labelledby="pending-policy-heading"
      className="border-border bg-card rounded-lg border"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <div>
          <h3 id="pending-policy-heading" className="text-foreground text-lg font-semibold">
            Pending policy update
          </h3>
          <p className="text-muted-foreground text-sm">
            Proposed {new Date(pending.proposedAt * 1000).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-medium ${
              ready ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {timeLeft}
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={!pending || busy}
            className="border-border text-foreground hover:bg-muted rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            Cancel update
          </button>
          <button
            type="button"
            onClick={onExecute}
            disabled={!ready || busy}
            title={ready ? 'Apply the pending update' : 'Available once the timelock has passed'}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Execute update
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="px-6 py-2 font-medium">
                Setting
              </th>
              <th scope="col" className="px-6 py-2 font-medium">
                Current
              </th>
              <th scope="col" className="px-6 py-2 font-medium">
                Proposed
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {POLICY_FIELDS.map(({ key, label }) => {
              const before = current?.[key]
              const proposed = pending.policy[key]
              const changed = before !== undefined && String(before) !== String(proposed)
              return (
                <tr key={key}>
                  <th scope="row" className="text-foreground px-6 py-2 text-left font-normal">
                    {label}
                  </th>
                  <td className="text-muted-foreground px-6 py-2 font-mono">
                    {formatPolicyValue(before)}
                  </td>
                  <td className="text-foreground px-6 py-2 font-mono">
                    {formatPolicyValue(proposed)}
                    {changed && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 font-sans text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Changed
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
