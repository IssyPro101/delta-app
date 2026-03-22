"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { DashboardDataResponse } from "@pipeline-intelligence/shared";

import { apiFetch, toErrorMessage } from "../lib/api";

type DashboardDataContextValue = {
  data: DashboardDataResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const initialLoad = data === null;

    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    void (async () => {
      try {
        const nextData = await apiFetch<DashboardDataResponse>("/api/dashboard");

        if (active) {
          setData(nextData);
        }
      } catch (error) {
        if (active) {
          setError(toErrorMessage(error));

          if (initialLoad) {
            setData(null);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <DashboardDataContext.Provider
      value={{
        data,
        loading,
        refreshing,
        error,
        refresh,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const value = useContext(DashboardDataContext);

  if (!value) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }

  return value;
}
