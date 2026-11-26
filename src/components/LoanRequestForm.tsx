'use client'

import { useState } from 'react'
import { AssetSelector } from './AssetSelector'
import { useAssetBalance } from '@/hooks/useAssetBalance'

export interface LoanRequestFormData {
  assetId: string
  amount: string
  duration: number
  interestRate: number
}

interface LoanRequestFormProps {
  onSubmit: (data: LoanRequestFormData) => Promise<void>
  isSubmitting?: boolean
  error?: string
}

export function LoanRequestForm({ onSubmit, isSubmitting = false, error }: LoanRequestFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState(30)
  const [interestRate, setInterestRate] = useState(5)
  const [formError, setFormError] = useState<string | null>(null)

  const { hasSufficientBalance } = useAssetBalance(selectedAsset)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)

    if (!selectedAsset) {
      setFormError('Please select an asset')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Please enter a valid amount')
      return
    }

    if (!hasSufficientBalance(amount)) {
      setFormError('Insufficient balance for this amount')
      return
    }

    try {
      await onSubmit({
        assetId: selectedAsset,
        amount,
        duration,
        interestRate,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create loan request')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <h2 className="text-xl font-semibold">Request Loan</h2>

      {(formError || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {formError || error}
        </div>
      )}

      <div>
        <AssetSelector
          value={selectedAsset}
          onChange={setSelectedAsset}
          label="Loan Asset"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="loan-amount" className="mb-2 block text-sm font-medium">
          Amount
        </label>
        <input
          id="loan-amount"
          type="number"
          step="0.000001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSubmitting || !selectedAsset}
          placeholder="Enter amount"
          className="w-full rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="loan-duration" className="mb-2 block text-sm font-medium">
          Duration (days)
        </label>
        <input
          id="loan-duration"
          type="number"
          min="1"
          max="365"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value, 10))}
          disabled={isSubmitting}
          className="w-full rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="loan-interest-rate" className="mb-2 block text-sm font-medium">
          Interest Rate (%)
        </label>
        <input
          id="loan-interest-rate"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={interestRate}
          onChange={(e) => setInterestRate(parseFloat(e.target.value))}
          disabled={isSubmitting}
          className="w-full rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedAsset}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Creating Loan Request...' : 'Create Loan Request'}
      </button>
    </form>
  )
}
