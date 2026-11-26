// @vitest-environment node
//
// When NEXT_PUBLIC_CONTRACT_ID is unset every read has to degrade to null (or
// documented defaults) rather than reaching for an RPC endpoint. These paths
// are what keeps the app renderable before a contract is deployed.
import { describe, expect, it, vi } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'

vi.mock('@/lib/stellar', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar')
  return { ...actual, isContractConfigured: () => false }
})

const { daoRead } = await import('@/lib/dao-client')

describe('daoRead without a configured contract', () => {
  it('returns null from hand-encoded reads instead of calling the RPC', async () => {
    const member = Keypair.random().publicKey()

    expect(await daoRead.getDelegate(member)).toBeNull()
    expect(await daoRead.getWhitelistedTokens()).toBeNull()
  })

  it('fills getContractInfo with documented defaults', async () => {
    expect(await daoRead.getContractInfo()).toEqual({
      version: '',
      admin: '',
      treasury: '',
      token: '',
      createdAt: 0,
    })
  })
})
