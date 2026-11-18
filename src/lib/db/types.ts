import type {
  AssetCategory,
  FixedIncomeIndexer,
  FixedIncomeType,
} from "@/types/portfolio";

export interface UpsertAssetInput {
  walletId: number;
  ticker: string;
  name: string;
  category: AssetCategory;
  currency?: "BRL" | "USD";
  logoUrl?: string | null;
  rating?: number;
  fixedIncomeType?: FixedIncomeType | null;
  indexer?: FixedIncomeIndexer | null;
  rate?: number | null;
  maturityDate?: string | null;
  issuer?: string | null;
  irExempt?: boolean;
  iofExempt?: boolean;
}

