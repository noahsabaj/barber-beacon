'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { format, parseISO } from 'date-fns';

interface WorkingHours {
  id: string;
  barberId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;
  isWorking: boolean;
  breaks: TimeBreak[];
}

interface TimeBreak {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  isRecurring: boolean;
}

interface ScheduleBlock {
  id: string;
  barberId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'unavailable' | 'break' | 'vacation' | 'appointment';
  title: string;
  description?: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEnd?: string;
}

interface AvailabilityOverride {
  id: string;
  barberId: string;
  date: string;
  isAvailable: boolean;
  workingHours?: {
    startTime: string;
    endTime: string;
  };
  reason?: string;
}

interface ScheduleSettings {
  defaultBookingDuration: number;
  bufferTimeBetweenBookings: number;
  maxAdvanceBookingDays: number;
  minAdvanceBookingHours: number;
  allowSameDayBooking: boolean;
  automaticConfirmation: boolean;
  timeZone: string;
}

// Main barber schedule hook
export function useBarberSchedule(barberId?: string) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const targetId = barberId || (user?.role === 'BARBER' ? user?.id : undefined);

  // Fetch working hours
  const {
    data: workingHours,
    isLoading: isLoadingHours,
    error: hoursError,
  } = useQuery({
    queryKey: ['barber-working-hours', targetId],
    queryFn: async (): Promise<WorkingHours[]> => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/working-hours`);
      if (!response.ok) throw new Error('Failed to fetch working hours');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Fetch schedule blocks
  const {
    data: scheduleBlocks,
    isLoading: isLoadingBlocks,
  } = useQuery({
    queryKey: ['barber-schedule-blocks', targetId],
    queryFn: async (): Promise<ScheduleBlock[]> => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/blocks`);
      if (!response.ok) throw new Error('Failed to fetch schedule blocks');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Fetch availability overrides
  const {
    data: availabilityOverrides,
    isLoading: isLoadingOverrides,
  } = useQuery({
    queryKey: ['barber-availability-overrides', targetId],
    queryFn: async (): Promise<AvailabilityOverride[]> => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/overrides`);
      if (!response.ok) throw new Error('Failed to fetch availability overrides');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Fetch schedule settings
  const {
    data: scheduleSettings,
    isLoading: isLoadingSettings,
  } = useQuery({
    queryKey: ['barber-schedule-settings', targetId],
    queryFn: async (): Promise<ScheduleSettings> => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/settings`);
      if (!response.ok) throw new Error('Failed to fetch schedule settings');
      return response.json();
    },
    enabled: !!targetId,
  });

  // Update working hours mutation
  const updateWorkingHoursMutation = useMutation({
    mutationFn: async (hours: Omit<WorkingHours, 'id' | 'barberId'>[]) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/working-hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(hours),
      });

      if (!response.ok) throw new Error('Failed to update working hours');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-working-hours', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-availability'] });
    },
  });

  // Create schedule block mutation
  const createScheduleBlockMutation = useMutation({
    mutationFn: async (block: Omit<ScheduleBlock, 'id' | 'barberId'>) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(block),
      });

      if (!response.ok) throw new Error('Failed to create schedule block');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-schedule-blocks', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-availability'] });
    },
  });

  // Update schedule block mutation
  const updateScheduleBlockMutation = useMutation({
    mutationFn: async ({ blockId, data }: { blockId: string; data: Partial<ScheduleBlock> }) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/blocks/${blockId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update schedule block');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-schedule-blocks', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-availability'] });
    },
  });

  // Delete schedule block mutation
  const deleteScheduleBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/blocks/${blockId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete schedule block');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-schedule-blocks', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-availability'] });
    },
  });

  // Create availability override mutation
  const createAvailabilityOverrideMutation = useMutation({
    mutationFn: async (override: Omit<AvailabilityOverride, 'id' | 'barberId'>) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/overrides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(override),
      });

      if (!response.ok) throw new Error('Failed to create availability override');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-availability-overrides', targetId] });
      queryClient.invalidateQueries({ queryKey: ['barber-availability'] });
    },
  });

  // Update schedule settings mutation
  const updateScheduleSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<ScheduleSettings>) => {
      const response = await fetch(`/api/barbers/${targetId}/schedule/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to update schedule settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-schedule-settings', targetId] });
    },
  });

  // Actions
  const updateWorkingHours = useCallback((hours: Omit<WorkingHours, 'id' | 'barberId'>[]) => {
    return updateWorkingHoursMutation.mutateAsync(hours);
  }, [updateWorkingHoursMutation]);

  const createScheduleBlock = useCallback((block: Omit<ScheduleBlock, 'id' | 'barberId'>) => {
    return createScheduleBlockMutation.mutateAsync(block);
  }, [createScheduleBlockMutation]);

  const updateScheduleBlock = useCallback((blockId: string, data: Partial<ScheduleBlock>) => {
    return updateScheduleBlockMutation.mutateAsync({ blockId, data });
  }, [updateScheduleBlockMutation]);

  const deleteScheduleBlock = useCallback((blockId: string) => {
    return deleteScheduleBlockMutation.mutateAsync(blockId);
  }, [deleteScheduleBlockMutation]);

  const createAvailabilityOverride = useCallback((override: Omit<AvailabilityOverride, 'id' | 'barberId'>) => {
    return createAvailabilityOverrideMutation.mutateAsync(override);
  }, [createAvailabilityOverrideMutation]);

  const updateScheduleSettings = useCallback((settings: Partial<ScheduleSettings>) => {
    return updateScheduleSettingsMutation.mutateAsync(settings);
  }, [updateScheduleSettingsMutation]);

  // Utility functions
  const getWorkingHoursForDay = useCallback((dayOfWeek: number): WorkingHours | null => {
    return workingHours?.find(wh => wh.dayOfWeek === dayOfWeek) || null;
  }, [workingHours]);

  const isWorkingDay = useCallback((date: Date): boolean => {
    const dayOfWeek = date.getDay();
    const hours = getWorkingHoursForDay(dayOfWeek);
    return hours ? hours.isWorking : false;
  }, [getWorkingHoursForDay]);

  const getScheduleBlocksForDate = useCallback((date: Date): ScheduleBlock[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleBlocks?.filter(block => block.date === dateStr) || [];
  }, [scheduleBlocks]);

  const getAvailabilityOverrideForDate = useCallback((date: Date): AvailabilityOverride | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityOverrides?.find(override => override.date === dateStr) || null;
  }, [availabilityOverrides]);

  const isAvailableOnDate = useCallback((date: Date): boolean => {
    // Check for availability override first
    const override = getAvailabilityOverrideForDate(date);
    if (override) {
      return override.isAvailable;
    }

    // Check if it's a working day
    if (!isWorkingDay(date)) {
      return false;
    }

    // Check for schedule blocks that make the day unavailable
    const blocks = getScheduleBlocksForDate(date);
    const dayBlocks = blocks.filter(block =>
      block.type === 'unavailable' || block.type === 'vacation'
    );

    return dayBlocks.length === 0;
  }, [getAvailabilityOverrideForDate, isWorkingDay, getScheduleBlocksForDate]);

  // Computed values
  const weeklySchedule = useMemo(() => {
    if (!workingHours) return [];

    return Array.from({ length: 7 }, (_, index) => {
      const dayOfWeek = index;
      const hours = getWorkingHoursForDay(dayOfWeek);
      return {
        dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index],
        isWorking: hours?.isWorking || false,
        startTime: hours?.startTime || '09:00',
        endTime: hours?.endTime || '17:00',
        breaks: hours?.breaks || [],
      };
    });
  }, [workingHours, getWorkingHoursForDay]);

  const upcomingBlocks = useMemo(() => {
    if (!scheduleBlocks) return [];

    const today = new Date();
    return scheduleBlocks
      .filter(block => parseISO(block.date) >= today)
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .slice(0, 5);
  }, [scheduleBlocks]);

  const isOwner = useMemo(() => {
    return user?.role === 'BARBER' && user?.id === targetId;
  }, [user?.role, user?.id, targetId]);

  const isLoading = isLoadingHours || isLoadingBlocks || isLoadingOverrides || isLoadingSettings;

  return {
    // Data
    workingHours: workingHours || [],
    scheduleBlocks: scheduleBlocks || [],
    availabilityOverrides: availabilityOverrides || [],
    scheduleSettings,
    weeklySchedule,
    upcomingBlocks,
    isLoading,
    error: hoursError,

    // Computed
    isOwner,

    // Actions
    updateWorkingHours,
    createScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    createAvailabilityOverride,
    updateScheduleSettings,

    // Utility functions
    getWorkingHoursForDay,
    isWorkingDay,
    getScheduleBlocksForDate,
    getAvailabilityOverrideForDate,
    isAvailableOnDate,

    // Mutation states
    isUpdatingHours: updateWorkingHoursMutation.isPending,
    isManagingBlocks: createScheduleBlockMutation.isPending ||
                     updateScheduleBlockMutation.isPending ||
                     deleteScheduleBlockMutation.isPending,
    isUpdatingSettings: updateScheduleSettingsMutation.isPending,
  };
}

// Hook for quick schedule actions
export function useQuickScheduleActions(barberId?: string) {
  const { createScheduleBlock, createAvailabilityOverride } = useBarberSchedule(barberId);

  const blockTimeSlot = useCallback(async (date: Date, startTime: string, endTime: string, reason: string) => {
    await createScheduleBlock({
      date: format(date, 'yyyy-MM-dd'),
      startTime,
      endTime,
      type: 'unavailable',
      title: reason,
      isRecurring: false,
    });
  }, [createScheduleBlock]);

  const takeBreak = useCallback(async (date: Date, startTime: string, endTime: string, title: string = 'Break') => {
    await createScheduleBlock({
      date: format(date, 'yyyy-MM-dd'),
      startTime,
      endTime,
      type: 'break',
      title,
      isRecurring: false,
    });
  }, [createScheduleBlock]);

  const markDayUnavailable = useCallback(async (date: Date, reason?: string) => {
    await createAvailabilityOverride({
      date: format(date, 'yyyy-MM-dd'),
      isAvailable: false,
      ...(reason !== undefined && { reason }),
    });
  }, [createAvailabilityOverride]);

  const extendWorkingHours = useCallback(async (date: Date, startTime: string, endTime: string) => {
    await createAvailabilityOverride({
      date: format(date, 'yyyy-MM-dd'),
      isAvailable: true,
      workingHours: { startTime, endTime },
    });
  }, [createAvailabilityOverride]);

  return {
    blockTimeSlot,
    takeBreak,
    markDayUnavailable,
    extendWorkingHours,
  };
}