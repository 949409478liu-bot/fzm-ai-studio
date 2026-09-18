"use client";

import { create } from "zustand";
import { listProviders } from "./providerApi";
import type { ProviderCapability, ProviderDto } from "./types";

interface ProviderStoreState {
  providers: ProviderDto[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<ProviderDto[]>;
  compatibleProviders: (capability: ProviderCapability) => ProviderDto[];
}

export const useProviderStore = create<ProviderStoreState>((set, get) => ({
  providers: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const body = await listProviders();
      set({ providers: body.providers, loaded: true });
      return body.providers;
    } finally {
      set({ loading: false });
    }
  },
  compatibleProviders: (capability) => get().providers.filter((provider) => provider.enabled && provider.models.some((model) => model.capabilities.includes(capability))),
}));
