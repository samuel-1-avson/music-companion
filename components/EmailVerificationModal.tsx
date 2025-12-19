/**
 * EmailVerificationModal - Modal for entering verification code
 * Shows when linking an account with a different email address
 */
import React, { useState } from 'react';
import { ICONS } from '../constants';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  provider: string;
  providerEmail: string;
  userEmail: string;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  provider,
  providerEmail,
  userEmail,
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      const success = await onVerify(code);
      if (!success) {
        setError('Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-md w-full">
        {/* Header */}
        <div className="bg-yellow-400 border-b-4 border-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ICONS.AlertTriangle size={24} className="text-black" />
            <h2 className="font-bold font-mono text-lg">Email Verification Required</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-yellow-500 transition-colors"
          >
            <ICONS.X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 border-2 border-yellow-400 p-4">
            <p className="text-sm font-mono">
              <strong>Different email detected!</strong>
            </p>
            <div className="mt-2 space-y-1 text-xs font-mono">
              <p>Your account: <strong>{userEmail}</strong></p>
              <p>{providerName} account: <strong>{providerEmail}</strong></p>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            We sent a 6-digit verification code to <strong>{providerEmail}</strong>.
            Enter it below to link this account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold font-mono uppercase mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full p-3 text-center text-2xl font-mono font-bold tracking-[0.5em] border-2 border-black focus:ring-2 focus:ring-blue-500 focus:outline-none"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-500 p-2 text-red-700 text-sm font-mono">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border-2 border-black font-bold font-mono text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={code.length !== 6 || isVerifying}
                className="flex-1 py-2 px-4 bg-green-500 text-white border-2 border-black font-bold font-mono text-sm hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <ICONS.Loader size={16} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </form>

          <p className="text-xs text-gray-500 text-center">
            Code expires in 10 minutes
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationModal;
