"use client";
import { api } from "~/trpc/react";

export interface TemplateParamMeta {
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  example?: string;
  default?: string;
  aliases?: string[];
}

export function useTemplateSchema(templateName: string | null) {
  const query = api.wikios.getTemplateData.useQuery(
    { title: templateName ?? "" },
    { enabled: Boolean(templateName), staleTime: 5 * 60_000 }
  );

  const td = (query.data?.templateData ?? null) as {
    params?: Record<string, TemplateParamMeta>;
    paramOrder?: string[];
    description?: string;
  } | null;

  const params = td?.params ?? {};
  const order = td?.paramOrder?.filter((k) => k in params) ?? Object.keys(params);

  return {
    schema: query.data ?? null,
    loading: query.isLoading,
    /** ordered [key, meta] pairs */
    paramList: order.map((key) => ({ key, meta: params[key] ?? {} })),
    hasSchema: Object.keys(params).length > 0,
  };
}
