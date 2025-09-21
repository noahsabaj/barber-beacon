'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

interface Service {
  id: string;
  barberId: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  minDuration: number;
  maxDuration?: number;
  isActive: boolean;
  popularity: number;
  images: string[];
  tags: string[];
  addOns: ServiceAddOn[];
  createdAt: string;
  updatedAt: string;
}

interface ServiceAddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  isRequired: boolean;
}

interface CreateServiceData {
  name: string;
  description: string;
  category: string;
  basePrice: number;
  minDuration: number;
  maxDuration?: number;
  tags?: string[];
  addOns?: Omit<ServiceAddOn, 'id'>[];
}

interface UpdateServiceData extends Partial<CreateServiceData> {
  isActive?: boolean;
}

interface ServiceStats {
  totalServices: number;
  activeServices: number;
  averagePrice: number;
  mostPopularService: Service | null;
  categoriesCount: { [category: string]: number };
  revenueByService: { serviceId: string; revenue: number; bookings: number }[];
}

// Main barber services hook
export function useBarberServices(barberId?: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const targetId = barberId || (user?.role === 'BARBER' ? user?.id : undefined);

  // Fetch services
  const {
    data: services,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['barber-services', targetId],
    queryFn: async (): Promise<Service[]> => {
      const response = await fetch(`/api/barbers/${targetId}/services`);
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Create service mutation
  const createServiceMutation = useMutation({
    mutationFn: async (data: CreateServiceData) => {
      const response = await fetch(`/api/barbers/${targetId}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-services', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-service-stats', targetId] });
    },
  });

  // Update service mutation
  const updateServiceMutation = useMutation({
    mutationFn: async ({ serviceId, data }: { serviceId: string; data: UpdateServiceData }) => {
      const response = await fetch(`/api/barbers/${targetId}/services/${serviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-services', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-service-stats', targetId] });
    },
  });

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await fetch(`/api/barbers/${targetId}/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete service');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-services', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-service-stats', targetId] });
    },
  });

  // Upload service image mutation
  const uploadServiceImageMutation = useMutation({
    mutationFn: async ({ serviceId, file }: { serviceId: string; file: File }) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/barbers/${targetId}/services/${serviceId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload service image');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-services', targetId] });
    },
  });

  // Actions
  const createService = useCallback((data: CreateServiceData) => {
    return createServiceMutation.mutateAsync(data);
  }, [createServiceMutation]);

  const updateService = useCallback((serviceId: string, data: UpdateServiceData) => {
    return updateServiceMutation.mutateAsync({ serviceId, data });
  }, [updateServiceMutation]);

  const deleteService = useCallback((serviceId: string) => {
    return deleteServiceMutation.mutateAsync(serviceId);
  }, [deleteServiceMutation]);

  const toggleServiceStatus = useCallback(async (serviceId: string) => {
    const service = services?.find(s => s.id === serviceId);
    if (service) {
      await updateService(serviceId, { isActive: !service.isActive });
    }
  }, [services, updateService]);

  const uploadServiceImage = useCallback((serviceId: string, file: File) => {
    return uploadServiceImageMutation.mutateAsync({ serviceId, file });
  }, [uploadServiceImageMutation]);

  // Computed values
  const activeServices = useMemo(() => {
    return services?.filter(service => service.isActive) || [];
  }, [services]);

  const servicesByCategory = useMemo(() => {
    const grouped: { [category: string]: Service[] } = {};
    services?.forEach(service => {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category]!.push(service);
    });
    return grouped;
  }, [services]);

  const priceRange = useMemo(() => {
    if (!services || services.length === 0) return { min: 0, max: 0 };

    const prices = services.map(s => s.basePrice);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [services]);

  const isOwner = useMemo(() => {
    return user?.role === 'BARBER' && user?.id === targetId;
  }, [user?.role, user?.id, targetId]);

  return {
    // Data
    services: services || [],
    activeServices,
    servicesByCategory,
    priceRange,
    isLoading,
    error,

    // Computed
    isOwner,

    // Actions
    createService,
    updateService,
    deleteService,
    toggleServiceStatus,
    uploadServiceImage,
    refetch,

    // Mutation states
    isCreating: createServiceMutation.isPending,
    isUpdating: updateServiceMutation.isPending,
    isDeleting: deleteServiceMutation.isPending,
    isUploadingImage: uploadServiceImageMutation.isPending,
    createError: createServiceMutation.error?.message,
    updateError: updateServiceMutation.error?.message,
    deleteError: deleteServiceMutation.error?.message,
  };
}

// Hook for service statistics and analytics
export function useBarberServiceStats(barberId?: string) {
  const { user } = useAuthStore();
  const targetId = barberId || (user?.role === 'BARBER' ? user?.id : undefined);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['barber-service-stats', targetId],
    queryFn: async (): Promise<ServiceStats> => {
      const response = await fetch(`/api/barbers/${targetId}/services/stats`);
      if (!response.ok) throw new Error('Failed to fetch service stats');
      return response.json();
    },
    enabled: !!targetId,
  });

  const topPerformingServices = useMemo(() => {
    if (!stats?.revenueByService) return [];

    return [...stats.revenueByService]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [stats?.revenueByService]);

  const servicePerformanceMetrics = useMemo(() => {
    if (!stats) return null;

    return {
      totalRevenue: stats.revenueByService.reduce((sum, service) => sum + service.revenue, 0),
      totalBookings: stats.revenueByService.reduce((sum, service) => sum + service.bookings, 0),
      averageBookingValue: stats.averagePrice,
      utilizationRate: stats.activeServices / stats.totalServices,
    };
  }, [stats]);

  return {
    stats,
    topPerformingServices,
    servicePerformanceMetrics,
    isLoading,
  };
}

// Hook for service categories management
export function useServiceCategories() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch('/api/services/categories');
      if (!response.ok) throw new Error('Failed to fetch service categories');
      return response.json();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const getPopularServices = useCallback(async (category: string) => {
    const response = await fetch(`/api/services/popular?category=${category}`);
    if (!response.ok) throw new Error('Failed to fetch popular services');
    return response.json();
  }, []);

  return {
    categories: categories || [],
    isLoading,
    getPopularServices,
  };
}

// Hook for service pricing recommendations
export function useServicePricing(serviceCategory: string, location?: string) {
  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['service-pricing', serviceCategory, location],
    queryFn: async () => {
      const params = new URLSearchParams({
        category: serviceCategory,
        ...(location && { location }),
      });

      const response = await fetch(`/api/services/pricing-recommendations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch pricing recommendations');
      return response.json();
    },
    enabled: !!serviceCategory,
  });

  const priceRecommendations = useMemo(() => {
    if (!pricingData) return null;

    return {
      suggested: pricingData.averagePrice,
      range: {
        min: pricingData.minPrice,
        max: pricingData.maxPrice,
      },
      marketPosition: {
        competitive: pricingData.averagePrice * 0.9,
        premium: pricingData.averagePrice * 1.2,
      },
    };
  }, [pricingData]);

  return {
    pricingData,
    priceRecommendations,
    isLoading,
  };
}

// Hook for service templates
export function useServiceTemplates() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['service-templates'],
    queryFn: async () => {
      const response = await fetch('/api/services/templates');
      if (!response.ok) throw new Error('Failed to fetch service templates');
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const getTemplatesByCategory = useCallback((category: string) => {
    return templates?.filter((template: any) => template.category === category) || [];
  }, [templates]);

  const createServiceFromTemplate = useCallback((templateId: string, customizations: Partial<CreateServiceData>) => {
    const template = templates?.find((t: any) => t.id === templateId);
    if (!template) return null;

    return {
      ...template,
      ...customizations,
      id: undefined, // Remove template ID
    };
  }, [templates]);

  return {
    templates: templates || [],
    isLoading,
    getTemplatesByCategory,
    createServiceFromTemplate,
  };
}