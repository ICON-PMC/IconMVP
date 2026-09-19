// Tipos de la base de datos de Icon.
//
// NOTA: escritos a mano. La generación automática `supabase gen types typescript --local`
// está bloqueada en el CLI v2.106 (exige login a la plataforma incluso en local).
// Cuando el CLI lo permita, regenerar con:
//   supabase gen types typescript --local > src/lib/database.types.ts
// Mantener sincronizado con supabase/migrations/.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cities: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; created_at?: string };
        Relationships: [];
      };
      tags: {
        Row: { id: string; type: Database["public"]["Enums"]["tag_type"]; name: string; slug: string; created_at: string };
        Insert: { id?: string; type: Database["public"]["Enums"]["tag_type"]; name: string; slug: string; created_at?: string };
        Update: { id?: string; type?: Database["public"]["Enums"]["tag_type"]; name?: string; slug?: string; created_at?: string };
        Relationships: [];
      };
      sizes: {
        Row: { id: string; system: Database["public"]["Enums"]["size_system"]; label: string; sort_order: number; aliases: string[] };
        Insert: { id?: string; system: Database["public"]["Enums"]["size_system"]; label: string; sort_order?: number; aliases?: string[] };
        Update: { id?: string; system?: Database["public"]["Enums"]["size_system"]; label?: string; sort_order?: number; aliases?: string[] };
        Relationships: [];
      };
      users: {
        Row: { id: string; auth_id: string | null; email: string | null; display_name: string | null; home_city_id: string | null; onboarded: boolean; role: Database["public"]["Enums"]["user_role"]; created_at: string; updated_at: string };
        Insert: { id?: string; auth_id?: string | null; email?: string | null; display_name?: string | null; home_city_id?: string | null; onboarded?: boolean; role?: Database["public"]["Enums"]["user_role"]; created_at?: string; updated_at?: string };
        Update: { id?: string; auth_id?: string | null; email?: string | null; display_name?: string | null; home_city_id?: string | null; onboarded?: boolean; role?: Database["public"]["Enums"]["user_role"]; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      brands: {
        Row: { id: string; name: string; slug: string; city_id: string | null; store_url: string | null; instagram: string | null; price_range: Database["public"]["Enums"]["price_range"] | null; bio: string | null; logo_url: string | null; is_active: boolean; is_verified: boolean; is_sustainable: boolean; owner_user_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; city_id?: string | null; store_url?: string | null; instagram?: string | null; price_range?: Database["public"]["Enums"]["price_range"] | null; bio?: string | null; logo_url?: string | null; is_active?: boolean; is_verified?: boolean; is_sustainable?: boolean; owner_user_id?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; city_id?: string | null; store_url?: string | null; instagram?: string | null; price_range?: Database["public"]["Enums"]["price_range"] | null; bio?: string | null; logo_url?: string | null; is_active?: boolean; is_verified?: boolean; is_sustainable?: boolean; owner_user_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      garments: {
        Row: { id: string; brand_id: string; title: string; description: string | null; price_cop: number | null; price_range: Database["public"]["Enums"]["price_range"] | null; product_url: string | null; color: string | null; fabric: string | null; status: Database["public"]["Enums"]["garment_status"]; source: Database["public"]["Enums"]["garment_source"]; created_by_user_id: string | null; popularity: number; published_at: string | null; search_text: string; created_at: string; updated_at: string };
        Insert: { id?: string; brand_id: string; title: string; description?: string | null; price_cop?: number | null; product_url?: string | null; color?: string | null; fabric?: string | null; status?: Database["public"]["Enums"]["garment_status"]; source?: Database["public"]["Enums"]["garment_source"]; created_by_user_id?: string | null; popularity?: number; published_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; brand_id?: string; title?: string; description?: string | null; price_cop?: number | null; product_url?: string | null; color?: string | null; fabric?: string | null; status?: Database["public"]["Enums"]["garment_status"]; source?: Database["public"]["Enums"]["garment_source"]; created_by_user_id?: string | null; popularity?: number; published_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      garment_images: {
        Row: { id: string; garment_id: string; cf_image_id: string; position: number; alt: string | null; created_at: string };
        Insert: { id?: string; garment_id: string; cf_image_id: string; position?: number; alt?: string | null; created_at?: string };
        Update: { id?: string; garment_id?: string; cf_image_id?: string; position?: number; alt?: string | null; created_at?: string };
        Relationships: [];
      };
      garment_tags: {
        Row: { garment_id: string; tag_id: string };
        Insert: { garment_id: string; tag_id: string };
        Update: { garment_id?: string; tag_id?: string };
        Relationships: [];
      };
      garment_sizes: {
        Row: { garment_id: string; size_id: string };
        Insert: { garment_id: string; size_id: string };
        Update: { garment_id?: string; size_id?: string };
        Relationships: [];
      };
      posts: {
        Row: { id: string; author_type: Database["public"]["Enums"]["post_author_type"]; author_brand_id: string | null; author_user_id: string | null; caption: string | null; status: Database["public"]["Enums"]["post_status"]; popularity: number; published_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; author_type: Database["public"]["Enums"]["post_author_type"]; author_brand_id?: string | null; author_user_id?: string | null; caption?: string | null; status?: Database["public"]["Enums"]["post_status"]; popularity?: number; published_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; author_type?: Database["public"]["Enums"]["post_author_type"]; author_brand_id?: string | null; author_user_id?: string | null; caption?: string | null; status?: Database["public"]["Enums"]["post_status"]; popularity?: number; published_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      post_images: {
        Row: { id: string; post_id: string; cf_image_id: string; position: number; width: number | null; height: number | null; created_at: string };
        Insert: { id?: string; post_id: string; cf_image_id: string; position?: number; width?: number | null; height?: number | null; created_at?: string };
        Update: { id?: string; post_id?: string; cf_image_id?: string; position?: number; width?: number | null; height?: number | null; created_at?: string };
        Relationships: [];
      };
      post_items: {
        Row: { id: string; post_id: string; garment_id: string; size_id: string | null; position_x: number | null; position_y: number | null; is_brand_verified: boolean; created_at: string };
        Insert: { id?: string; post_id: string; garment_id: string; size_id?: string | null; position_x?: number | null; position_y?: number | null; is_brand_verified?: boolean; created_at?: string };
        Update: { id?: string; post_id?: string; garment_id?: string; size_id?: string | null; position_x?: number | null; position_y?: number | null; is_brand_verified?: boolean; created_at?: string };
        Relationships: [];
      };
      post_tags: {
        Row: { post_id: string; tag_id: string };
        Insert: { post_id: string; tag_id: string };
        Update: { post_id?: string; tag_id?: string };
        Relationships: [];
      };
      post_brand_reviews: {
        Row: { id: string; post_id: string; brand_id: string; status: Database["public"]["Enums"]["brand_review_status"]; decided_at: string | null; created_at: string };
        Insert: { id?: string; post_id: string; brand_id: string; status?: Database["public"]["Enums"]["brand_review_status"]; decided_at?: string | null; created_at?: string };
        Update: { id?: string; post_id?: string; brand_id?: string; status?: Database["public"]["Enums"]["brand_review_status"]; decided_at?: string | null; created_at?: string };
        Relationships: [];
      };
      user_preferences: {
        Row: { user_id: string; tag_id: string };
        Insert: { user_id: string; tag_id: string };
        Update: { user_id?: string; tag_id?: string };
        Relationships: [];
      };
      saved_posts: {
        Row: { user_id: string; post_id: string; created_at: string };
        Insert: { user_id: string; post_id: string; created_at?: string };
        Update: { user_id?: string; post_id?: string; created_at?: string };
        Relationships: [];
      };
      saved_garments: {
        Row: { user_id: string; garment_id: string; source_post_id: string | null; created_at: string };
        Insert: { user_id: string; garment_id: string; source_post_id?: string | null; created_at?: string };
        Update: { user_id?: string; garment_id?: string; source_post_id?: string | null; created_at?: string };
        Relationships: [];
      };
      outbound_clicks: {
        Row: { id: string; garment_id: string | null; brand_id: string | null; post_id: string | null; user_id: string | null; source: Database["public"]["Enums"]["click_source"]; created_at: string };
        Insert: { id?: string; garment_id?: string | null; brand_id?: string | null; post_id?: string | null; user_id?: string | null; source: Database["public"]["Enums"]["click_source"]; created_at?: string };
        Update: { id?: string; garment_id?: string | null; brand_id?: string | null; post_id?: string | null; user_id?: string | null; source?: Database["public"]["Enums"]["click_source"]; created_at?: string };
        Relationships: [];
      };
      brand_instagram_connections: {
        Row: { brand_id: string; ig_user_id: string; username: string | null; account_type: string | null; access_token: string; token_expires_at: string; connected_by_user_id: string | null; connected_at: string; updated_at: string };
        Insert: { brand_id: string; ig_user_id: string; username?: string | null; account_type?: string | null; access_token: string; token_expires_at: string; connected_by_user_id?: string | null; connected_at?: string; updated_at?: string };
        Update: { brand_id?: string; ig_user_id?: string; username?: string | null; account_type?: string | null; access_token?: string; token_expires_at?: string; connected_by_user_id?: string | null; connected_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: {
      post_feed: {
        Row: {
          id: string;
          caption: string | null;
          popularity: number;
          published_at: string | null;
          brand_id: string;
          brand_name: string;
          brand_slug: string;
          brand_verified: boolean;
          city_slug: string | null;
          city_name: string | null;
          image: string | null;
          occasions: string[];
          styles: string[];
          temperatures: string[];
          categories: string[];
          min_price: number | null;
          max_price: number | null;
          price_ranges: string[];
          score: number;
        };
        Relationships: [];
      };
      brand_click_counts: {
        Row: { brand_id: string; brand_name: string; clicks: number };
        Relationships: [];
      };
      garment_click_counts: {
        Row: { garment_id: string; title: string; brand_id: string; clicks: number };
        Relationships: [];
      };
    };
    Functions: {
      current_user_id: { Args: Record<string, never>; Returns: string };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      search_garments: {
        Args: {
          q?: string | null;
          p_cities?: string[] | null;
          p_categories?: string[] | null;
          p_prices?: string[] | null;
          p_sort?: string | null;
          p_user_city?: string | null;
        };
        Returns: {
          id: string;
          title: string;
          price_cop: number | null;
          brand_id: string;
          brand_name: string;
          brand_slug: string;
          city_slug: string | null;
          city_name: string | null;
          image: string | null;
          popularity: number;
          sim: number;
        }[];
      };
      search_posts: {
        Args: { q?: string | null; p_user_city?: string | null };
        Returns: { id: string; sim: number; same_city: boolean }[];
      };
      search_brands: {
        Args: { q?: string | null; p_user_city?: string | null };
        Returns: {
          id: string;
          slug: string;
          name: string;
          bio: string | null;
          city_name: string | null;
          is_verified: boolean;
          is_sustainable: boolean;
          logo_url: string | null;
          garments: number;
          created_at: string;
          sim: number;
          same_city: boolean;
        }[];
      };
    };
    Enums: {
      user_role: "user" | "curator" | "admin" | "brand";
      price_range: "under_100k" | "100k_200k" | "200k_350k" | "350k_500k" | "over_500k";
      tag_type: "category" | "occasion" | "style" | "temperature";
      garment_status: "pending" | "published" | "archived";
      garment_source: "team" | "brand" | "user_proposed";
      post_author_type: "team" | "brand" | "user";
      post_status: "draft" | "published" | "archived";
      size_system: "alpha" | "numeric" | "special";
      brand_review_status: "pending" | "accepted" | "declined";
      click_source: "feed" | "post" | "garment" | "brand_profile";
    };
    CompositeTypes: Record<string, never>;
  };
};

// Helpers de conveniencia
type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
