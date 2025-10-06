"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  X, 
  Crown, 
  Newspaper, 
  Users, 
  Sparkles,
  Check,
  AlertCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { MediaSearchModal } from '~/components/MediaSearchModal';
import { WikiSearch } from './WikiSearch';

interface AccountCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: any) => void;
  countryId: string;
  countryName: string;
  existingAccountCount: number;
  maxAccounts?: number;
}

interface ThinkpagesAccountInput {
  accountType: 'government' | 'media' | 'citizen';
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  verified: boolean;
  postingFrequency: 'active' | 'moderate' | 'low';
  politicalLean: 'left' | 'center' | 'right';
  personality: 'serious' | 'casual' | 'satirical';
  profileImageUrl?: string;
}

const ACCOUNT_TYPES = {
  government: {
    icon: Crown,
    label: 'Government',
    description: 'Official government accounts (Presidential, ministerial, diplomatic)',
    maxAccounts: 5,
    color: 'amber',
    examples: ['Presidential Office', 'Minister of Foreign Affairs', 'Ambassador to UN']
  },
  media: {
    icon: Newspaper,
    label: 'Media',
    description: 'News organizations, journalists, and bloggers',
    maxAccounts: 10,
    color: 'blue',
    examples: ['National News Network', 'Political Reporter', 'Economic Analyst']
  },
  citizen: {
    icon: Users,
    label: 'Citizens',
    description: 'Activists, influencers, and common people',
    maxAccounts: 17,
    color: 'green',
    examples: ['Student Activist', 'Business Owner', 'Cultural Influencer']
  }
} as const;

export function AccountCreationModal({
  isOpen,
  onClose,
  onAccountCreated,
  countryId,
  countryName,
  existingAccountCount,
  maxAccounts = 25
}: AccountCreationModalProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [formData, setFormData] = useState<ThinkpagesAccountInput>({
    accountType: 'citizen',
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
    verified: false,
    postingFrequency: 'moderate',
    politicalLean: 'center',
    personality: 'serious',
    profileImageUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUnsplashSearch, setShowUnsplashSearch] = useState(false);
  const [imageSource, setImageSource] = useState<'unsplash' | 'upload' | 'wiki'>('unsplash');
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);

  const createAccountMutation = api.thinkpages.createAccount.useMutation();

  const { data: usernameAvailability, isLoading: isLoadingUsernameAvailability } = api.thinkpages.checkUsernameAvailability.useQuery(
    { username: formData.username },
    { enabled: formData.username.length >= 3, staleTime: 500, refetchOnWindowFocus: false }
  );

  const { data: accountCountsByType, isLoading: isLoadingAccountCountsByType } = api.thinkpages.getAccountCountsByType.useQuery(
    { countryId },
    { enabled: isOpen, staleTime: Infinity }
  );

  useEffect(() => {
    if (formData.username.length >= 3) {
      setIsUsernameAvailable(usernameAvailability?.isAvailable ?? null);
      setIsCheckingUsername(isLoadingUsernameAvailability);
    } else {
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
    }
  }, [usernameAvailability, isLoadingUsernameAvailability, formData.username]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal is closed
      setStep('type');
      setFormData({
        accountType: 'citizen',
        firstName: '',
        lastName: '',
        username: '',
        bio: '',
        verified: false,
        postingFrequency: 'moderate',
        politicalLean: 'center',
        personality: 'serious',
        profileImageUrl: '',
      });
      setErrors({});
      setIsUsernameAvailable(null);
    }
  }, [isOpen]);

  // Always allow account creation - backend will enforce the actual limit
  const canCreateMoreAccounts = true;
  const accountsRemaining = maxAccounts - existingAccountCount;

  const handleUsernameChange = (value: string) => {
    setFormData(prev => ({ ...prev, username: value }));
    if (errors.username) setErrors(e => ({...e, username: ''}));
  };

  const handleImageSelected = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, profileImageUrl: imageUrl }));
    setShowUnsplashSearch(false);
    toast.success('Profile picture selected!');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (usernameAvailability?.isAvailable === false) {
      newErrors.username = 'Username is not available or invalid';
    } else if (isLoadingUsernameAvailability) {
      newErrors.username = 'Checking username availability...';
    }
    if (!formData.bio.trim()) newErrors.bio = 'Bio is required';
    else if (formData.bio.length > 160) {
      newErrors.bio = 'Bio must be 160 characters or less';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    try {
      const newAccount = await createAccountMutation.mutateAsync({
        ...formData,
        countryId,
      });
      toast.success('Account created successfully!');
      onAccountCreated(newAccount);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center hs-overlay-backdrop-open:bg-black/50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
          >
            <div className="bg-neutral-900/50 border border-white/10 rounded-xl shadow-lg backdrop-blur-xl flex flex-col">
              {/* Header */}
              <div className="py-4 px-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Sparkles className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Create Thinkpages Account</h3>
                    <p className="text-sm text-neutral-400">
                      {countryName} • {accountsRemaining} slots remaining
                    </p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!canCreateMoreAccounts && (
                <div className="p-4 m-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Account Limit Reached</span>
                  </div>
                  <p className="text-xs text-red-300 mt-1 pl-7">
                    You have reached the maximum of {maxAccounts} accounts. Delete an existing account to create a new one.
                  </p>
                </div>
              )}

              {/* Body */}
              <div className="p-6 overflow-y-auto overflow-x-visible">
                <AnimatePresence mode="wait">
                  {step === 'type' ? (
                    <motion.div
                      key="type-selection"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-semibold text-white">Choose Account Type</h3>
                      <div className="grid gap-4">
                        {Object.entries(ACCOUNT_TYPES).map(([type, config]) => {
                          const Icon = config.icon;
                          const isSelected = formData.accountType === type;
                          const currentCount = accountCountsByType?.[type as keyof typeof ACCOUNT_TYPES] || 0;
                          const canCreateThisType = currentCount < config.maxAccounts;
                          const typeAccountsRemaining = config.maxAccounts - currentCount;

                          return (
                            <button
                              key={type}
                              onClick={() => setFormData(prev => ({ ...prev, accountType: type as any, verified: type === 'government' }))}
                              disabled={!canCreateThisType || isLoadingAccountCountsByType}
                              className={cn(
                                "w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-4",
                                isSelected ? "border-blue-500 bg-blue-500/10" : "border-neutral-700 hover:border-blue-400 hover:bg-blue-500/5",
                                (!canCreateThisType || isLoadingAccountCountsByType) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className={cn("p-2 rounded-lg", `bg-${config.color}-500/20 text-${config.color}-400`)}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-white">{config.label}</h4>
                                  <span className="text-xs py-0.5 px-2 bg-neutral-700 text-neutral-300 rounded-full">Max {config.maxAccounts}</span>
                                  {type === 'government' && <span className="text-xs py-0.5 px-2 bg-blue-500/20 text-blue-400 rounded-full">Auto-Verified</span>}
                                </div>
                                <p className="text-sm text-neutral-400 mb-2">{config.description}</p>
                                <p className="text-xs text-neutral-500">
                                  {canCreateThisType ? 
                                    `Remaining: ${typeAccountsRemaining} / ${config.maxAccounts}` : 
                                    `Limit Reached: ${config.maxAccounts} / ${config.maxAccounts}`
                                  }
                                </p>
                                <p className="text-xs text-neutral-500">Examples: {config.examples.join(', ')}</p>
                              </div>
                              {isSelected && <div className="p-1 bg-blue-500 rounded-full text-white"><Check className="h-4 w-4" /></div>}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="account-details"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3">
                        <button onClick={() => setStep('type')} className="p-2 rounded-full hover:bg-white/10 text-neutral-300 transition-colors">
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h3 className="text-lg font-semibold text-white">Account Details</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">First Name</label>
                          <input type="text" value={formData.firstName} onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} placeholder="Enter first name" className={cn("py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500", errors.firstName && "border-red-500")} />
                          {errors.firstName && <p className="text-xs text-red-400 mt-1">{errors.firstName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">Last Name</label>
                          <input type="text" value={formData.lastName} onChange={e => setFormData(p => ({...p, lastName: e.target.value}))} placeholder="Enter last name" className={cn("py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500", errors.lastName && "border-red-500")} />
                          {errors.lastName && <p className="text-xs text-red-400 mt-1">{errors.lastName}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-neutral-300">Username</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3 flex items-center text-neutral-500">@</span>
                          <input type="text" value={formData.username} onChange={e => handleUsernameChange(e.target.value)} placeholder="username" className={cn("py-3 px-4 pl-8 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500", errors.username && "border-red-500", isUsernameAvailable && "border-green-500")} />
                          <div className="absolute inset-y-0 right-3 flex items-center">
                            {isCheckingUsername && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
                            {isUsernameAvailable === true && <Check className="h-5 w-5 text-green-500" />}
                            {isUsernameAvailable === false && !errors.username && <AlertCircle className="h-5 w-5 text-red-500" />}
                          </div>
                        </div>
                        {errors.username ? <p className="text-xs text-red-400 mt-1">{errors.username}</p> :
                         isUsernameAvailable === true ? <p className="text-xs text-green-400 mt-1">Username is available</p> :
                         isUsernameAvailable === false ? <p className="text-xs text-red-400 mt-1">Username is invalid or already taken</p> :
                         <p className="text-xs text-neutral-500 mt-1">3-24 characters, letters, numbers, and underscores only.</p>
                        }
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-neutral-300">Bio</label>
                        <textarea value={formData.bio} onChange={e => setFormData(p => ({...p, bio: e.target.value}))} placeholder="Describe this account..." maxLength={160} className={cn("py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500 min-h-[80px]", errors.bio && "border-red-500")} />
                        <div className="flex justify-between items-center mt-1">
                          {errors.bio ? <p className="text-xs text-red-400">{errors.bio}</p> : <span />}
                          <span className="text-xs text-neutral-500">{formData.bio.length}/160</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-neutral-300">Profile Picture</label>
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-24 rounded-full overflow-hidden border border-neutral-700 flex-shrink-0">
                            {formData.profileImageUrl ? (
                              <img src={formData.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500 text-xs">No Image</div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 relative">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2">
                                Change Source
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="z-[80]">
                                <DropdownMenuItem onSelect={() => setImageSource('unsplash')}>
                                  Search Image Repository
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setImageSource('upload')}>
                                  Upload Image
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setImageSource('wiki')}>
                                  Search Wiki (IxWiki/IiWiki)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {imageSource === 'unsplash' && (
                              <button
                                type="button"
                                onClick={() => setShowUnsplashSearch(true)}
                                className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Search Image Repository
                              </button>
                            )}
                            {imageSource === 'upload' && (
                              <button
                                type="button"
                                onClick={() => toast.info('File upload not implemented yet.')}
                                className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Upload Image
                              </button>
                            )}
                            {imageSource === 'wiki' && (
                              <WikiSearch onImageSelect={handleImageSelected} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">Posting Frequency</label>
                          <select value={formData.postingFrequency} onChange={e => setFormData(p => ({...p, postingFrequency: e.target.value as any}))} className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500">
                            <option value="low">Low</option>
                            <option value="moderate">Moderate</option>
                            <option value="active">Active</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">Political Lean</label>
                          <select value={formData.politicalLean} onChange={e => setFormData(p => ({...p, politicalLean: e.target.value as any}))} className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500">
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">Personality</label>
                          <select value={formData.personality} onChange={e => setFormData(p => ({...p, personality: e.target.value as any}))} className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500">
                            <option value="serious">Serious</option>
                            <option value="casual">Casual</option>
                            <option value="satirical">Satirical</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="py-4 px-6 flex justify-end items-center border-t border-white/10">
                <div className="flex gap-x-2">
                  <button type="button" onClick={onClose} className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-neutral-700 text-white hover:bg-neutral-600 disabled:opacity-50 disabled:pointer-events-none">
                    Cancel
                  </button>
                  {step === 'type' ? (
                    <button type="button" onClick={() => setStep('details')} disabled={!canCreateMoreAccounts} className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
                      Continue
                    </button>
                  ) : (
                    <button type="button" onClick={handleCreateAccount} disabled={!isUsernameAvailable || Object.keys(errors).length > 0 || isCheckingUsername || createAccountMutation.isPending} className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
                      {createAccountMutation.isPending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Create Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <MediaSearchModal 
            isOpen={showUnsplashSearch}
            onClose={() => setShowUnsplashSearch(false)}
            onImageSelect={handleImageSelected}
          />
        </div>
      )}
    </AnimatePresence>
  );
}