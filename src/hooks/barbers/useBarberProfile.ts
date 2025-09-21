'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

interface BarberProfile {
  id: string;
  userId: string;
  businessName: string;
  description?: string;
  specialties: string[];
  experience: number;
  certifications: string[];
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
    social?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
    };
  };
  portfolio: {
    id: string;
    url: string;
    caption?: string;
    type: 'image' | 'video';
  }[];
  rating: {
    average: number;
    count: number;
  };
  verification: {
    isVerified: boolean;
    documents: string[];
  };
  settings: {
    acceptsOnlineBooking: boolean;
    requiresDeposit: boolean;
    depositAmount?: number;
    cancellationPolicy: string;
    instagramIntegration: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProfileUpdateData {
  businessName?: string;
  description?: string;
  specialties?: string[];
  experience?: number;
  certifications?: string[];
  location?: Partial<BarberProfile['location']>;
  contact?: Partial<BarberProfile['contact']>;
  settings?: Partial<BarberProfile['settings']>;
}

interface PortfolioItem {
  url: string;
  caption?: string;
  type: 'image' | 'video';
}

// Main barber profile hook
export function useBarberProfile(barberId?: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const targetId = barberId || (user?.role === 'BARBER' ? user?.id : undefined);

  // Fetch barber profile
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['barber-profile', targetId],
    queryFn: async (): Promise<BarberProfile> => {
      const response = await fetch(`/api/barbers/${targetId}/profile`);
      if (!response.ok) throw new Error('Failed to fetch barber profile');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const response = await fetch(`/api/barbers/${targetId}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-profile', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-profiles'] });
    },
  });

  // Upload profile image mutation
  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/barbers/${targetId}/profile/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload profile image');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-profile', targetId] });
    },
  });

  // Portfolio management mutations
  const addPortfolioItemMutation = useMutation({
    mutationFn: async (item: PortfolioItem) => {
      const response = await fetch(`/api/barbers/${targetId}/portfolio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) throw new Error('Failed to add portfolio item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-profile', targetId] });
    },
  });

  const removePortfolioItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/barbers/${targetId}/portfolio/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to remove portfolio item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-profile', targetId] });
    },
  });

  // Actions
  const updateProfile = useCallback((data: ProfileUpdateData) => {
    return updateProfileMutation.mutateAsync(data);
  }, [updateProfileMutation]);

  const uploadProfileImage = useCallback((file: File) => {
    return uploadProfileImageMutation.mutateAsync(file);
  }, [uploadProfileImageMutation]);

  const addPortfolioItem = useCallback((item: PortfolioItem) => {
    return addPortfolioItemMutation.mutateAsync(item);
  }, [addPortfolioItemMutation]);

  const removePortfolioItem = useCallback((itemId: string) => {
    return removePortfolioItemMutation.mutateAsync(itemId);
  }, [removePortfolioItemMutation]);

  // Computed values
  const isOwner = useMemo(() => {
    return user?.role === 'BARBER' && user?.id === targetId;
  }, [user?.id, user?.role, targetId]);

  const completionPercentage = useMemo(() => {
    if (!profile) return 0;

    const fields = [
      profile.businessName,
      profile.description,
      profile.specialties?.length > 0,
      profile.location?.address,
      profile.contact?.phone,
      profile.portfolio?.length > 0,
      profile.certifications?.length > 0,
    ];

    const completedFields = fields.filter(Boolean).length;
    return Math.round((completedFields / fields.length) * 100);
  }, [profile]);

  const isProfileComplete = completionPercentage >= 80;

  return {
    // Data
    profile,
    isLoading,
    error,

    // Computed
    isOwner,
    completionPercentage,
    isProfileComplete,

    // Actions
    updateProfile,
    uploadProfileImage,
    addPortfolioItem,
    removePortfolioItem,
    refetch,

    // Mutation states
    isUpdating: updateProfileMutation.isPending,
    updateError: updateProfileMutation.error?.message,
    isUploadingImage: uploadProfileImageMutation.isPending,
    isManagingPortfolio: addPortfolioItemMutation.isPending || removePortfolioItemMutation.isPending,
  };
}

// Hook for barber verification process
export function useBarberVerification() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: verificationStatus } = useQuery({
    queryKey: ['barber-verification', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/barbers/${user?.id}/verification`);
      if (!response.ok) throw new Error('Failed to fetch verification status');
      return response.json();
    },
    enabled: !!(user?.role === 'BARBER' && user?.id),
  });

  const submitVerificationMutation = useMutation({
    mutationFn: async (documents: File[]) => {
      const formData = new FormData();
      documents.forEach((doc, index) => {
        formData.append(`document_${index}`, doc);
      });

      const response = await fetch(`/api/barbers/${user?.role === 'BARBER' ? user?.id : ''}/verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to submit verification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-verification', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['barber-profile', user?.id] });
    },
  });

  const submitVerification = useCallback((documents: File[]) => {
    return submitVerificationMutation.mutateAsync(documents);
  }, [submitVerificationMutation]);

  return {
    verificationStatus,
    submitVerification,
    isSubmitting: submitVerificationMutation.isPending,
    error: submitVerificationMutation.error?.message,
  };
}

// Hook for barber settings management
export function useBarberSettings() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<BarberProfile['settings']>) => {
      const response = await fetch(`/api/barbers/${user?.role === 'BARBER' ? user?.id : ''}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-profile', user?.id] });
    },
  });

  const updateSettings = useCallback((settings: Partial<BarberProfile['settings']>) => {
    return updateSettingsMutation.mutateAsync(settings);
  }, [updateSettingsMutation]);

  const toggleOnlineBooking = useCallback(() => {
    // First get current profile to toggle the setting
    const currentProfile = queryClient.getQueryData<BarberProfile>(['barber-profile', user?.id]);
    if (currentProfile) {
      updateSettings({
        acceptsOnlineBooking: !currentProfile.settings.acceptsOnlineBooking
      });
    }
  }, [updateSettings, queryClient, user?.id]);

  const updateDepositSettings = useCallback((requiresDeposit: boolean, amount?: number) => {
    updateSettings({
      requiresDeposit,
      ...(requiresDeposit && amount !== undefined && { depositAmount: amount }),
    });
  }, [updateSettings]);

  return {
    updateSettings,
    toggleOnlineBooking,
    updateDepositSettings,
    isUpdating: updateSettingsMutation.isPending,
    error: updateSettingsMutation.error?.message,
  };
}