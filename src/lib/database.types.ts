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
        Row: { id: string; name: string; slug: string; department: string | null; dane_code: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; department?: string | null; dane_code?: string | null; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; department?: string | null; dane_code?: string | null; created_at?: string };
        Relationships: [];
      };
      tags: {
        Row: { id: string; type: Database["public"]["Enums"]["tag_type"]; name: string; slug: string; name_key: string; is_hidden: boolean; created_by_brand_id: string | null; created_by_user_id: string | null; created_at: string };
        Insert: { id?: string; type: Database["public"]["Enums"]["tag_type"]; name: string; slug: string; is_hidden?: boolean; created_by_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string };
        Update: { id?: string; type?: Database["public"]["Enums"]["tag_type"]; name?: string; slug?: string; is_hidden?: boolean; created_by_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string };
        Relationships: [];
      };
      tag_blocklist: {
        Row: { word: string };
        Insert: { word: string };
        Update: { word?: string };
        Relationships: [];
      };
      colors: {
        Row: { id: string; name: string; slug: string; name_key: string; hex: string | null; position: number; is_hidden: boolean; created_by_brand_id: string | null; created_by_user_id: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; hex?: string | null; position?: number; is_hidden?: boolean; created_by_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; hex?: string | null; position?: number; is_hidden?: boolean; created_by_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string };
        Relationships: [];
      };
      garment_colors: {
        Row: { garment_id: string; color_id: string };
        Insert: { garment_id: string; color_id: string };
        Update: { garment_id?: string; color_id?: string };
        Relationships: [];
      };
      garment_embeddings: {
        Row: { garment_id: string; embedding: string | null; image_key: string; model: string; status: "pending" | "ready" | "failed"; error: string | null; attempts: number; updated_at: string };
        Insert: { garment_id: string; embedding?: string | null; image_key: string; model?: string; status?: "pending" | "ready" | "failed"; error?: string | null; attempts?: number; updated_at?: string };
        Update: { garment_id?: string; embedding?: string | null; image_key?: string; model?: string; status?: "pending" | "ready" | "failed"; error?: string | null; attempts?: number; updated_at?: string };
        Relationships: [];
      };
      photo_searches: {
        Row: { id: string; kind: "photo" | "similar"; requester_key: string; user_id: string | null; detected_category: string | null; top_similarity: number | null; results: number; below_threshold: boolean; source_garment_id: string | null; created_at: string };
        Insert: { id?: string; kind: "photo" | "similar"; requester_key: string; user_id?: string | null; detected_category?: string | null; top_similarity?: number | null; results: number; below_threshold: boolean; source_garment_id?: string | null; created_at?: string };
        Update: { id?: string; kind?: "photo" | "similar"; requester_key?: string; user_id?: string | null; detected_category?: string | null; top_similarity?: number | null; results?: number; below_threshold?: boolean; source_garment_id?: string | null; created_at?: string };
        Relationships: [];
      };
      sizes: {
        Row: { id: string; system: Database["public"]["Enums"]["size_system"]; label: string; sort_order: number; aliases: string[] };
        Insert: { id?: string; system: Database["public"]["Enums"]["size_system"]; label: string; sort_order?: number; aliases?: string[] };
        Update: { id?: string; system?: Database["public"]["Enums"]["size_system"]; label?: string; sort_order?: number; aliases?: string[] };
        Relationships: [];
      };
      users: {
        Row: { id: string; auth_id: string | null; email: string | null; display_name: string | null; home_city_id: string | null; onboarded: boolean; role: Database["public"]["Enums"]["user_role"]; brand_id: string | null; handle: string; handle_key: string; handle_changed_at: string | null; avatar_key: string | null; avatar_bytes: number; bio: string | null; link_url: string | null; is_public: boolean; show_likes: boolean; posting_blocked_at: string | null; posting_blocked_reason: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; auth_id?: string | null; email?: string | null; display_name?: string | null; home_city_id?: string | null; onboarded?: boolean; role?: Database["public"]["Enums"]["user_role"]; brand_id?: string | null; handle?: string; handle_changed_at?: string | null; avatar_key?: string | null; avatar_bytes?: number; bio?: string | null; link_url?: string | null; is_public?: boolean; show_likes?: boolean; posting_blocked_at?: string | null; posting_blocked_reason?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; auth_id?: string | null; email?: string | null; display_name?: string | null; home_city_id?: string | null; onboarded?: boolean; role?: Database["public"]["Enums"]["user_role"]; brand_id?: string | null; handle?: string; handle_changed_at?: string | null; avatar_key?: string | null; avatar_bytes?: number; bio?: string | null; link_url?: string | null; is_public?: boolean; show_likes?: boolean; posting_blocked_at?: string | null; posting_blocked_reason?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      brands: {
        Row: { id: string; name: string; slug: string; city_id: string | null; store_url: string | null; instagram: string | null; price_range: Database["public"]["Enums"]["price_range"] | null; bio: string | null; logo_url: string | null; logo_bytes: number; logo_variants_ready: boolean; is_active: boolean; is_verified: boolean; is_sustainable: boolean; owner_user_id: string | null; status: Database["public"]["Enums"]["brand_status"]; rejection_note: string | null; submitted_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; city_id?: string | null; store_url?: string | null; instagram?: string | null; price_range?: Database["public"]["Enums"]["price_range"] | null; bio?: string | null; logo_url?: string | null; logo_bytes?: number; logo_variants_ready?: boolean; is_active?: boolean; is_verified?: boolean; is_sustainable?: boolean; owner_user_id?: string | null; status?: Database["public"]["Enums"]["brand_status"]; rejection_note?: string | null; submitted_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; city_id?: string | null; store_url?: string | null; instagram?: string | null; price_range?: Database["public"]["Enums"]["price_range"] | null; bio?: string | null; logo_url?: string | null; logo_bytes?: number; logo_variants_ready?: boolean; is_active?: boolean; is_verified?: boolean; is_sustainable?: boolean; owner_user_id?: string | null; status?: Database["public"]["Enums"]["brand_status"]; rejection_note?: string | null; submitted_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      garments: {
        Row: { id: string; brand_id: string; title: string; description: string | null; price_cop: number | null; price_range: Database["public"]["Enums"]["price_range"] | null; product_url: string | null; color: string | null; fabric: string | null; status: Database["public"]["Enums"]["garment_status"]; source: Database["public"]["Enums"]["garment_source"]; created_by_user_id: string | null; popularity: number; published_at: string | null; search_text: string; last_seen_at: string | null; discontinued_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; brand_id: string; title: string; description?: string | null; price_cop?: number | null; product_url?: string | null; color?: string | null; fabric?: string | null; status?: Database["public"]["Enums"]["garment_status"]; source?: Database["public"]["Enums"]["garment_source"]; created_by_user_id?: string | null; popularity?: number; published_at?: string | null; last_seen_at?: string | null; discontinued_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; brand_id?: string; title?: string; description?: string | null; price_cop?: number | null; product_url?: string | null; color?: string | null; fabric?: string | null; status?: Database["public"]["Enums"]["garment_status"]; source?: Database["public"]["Enums"]["garment_source"]; created_by_user_id?: string | null; popularity?: number; published_at?: string | null; last_seen_at?: string | null; discontinued_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      garment_images: {
        Row: { id: string; garment_id: string; cf_image_id: string; position: number; bytes: number; variants_ready: boolean; width: number | null; height: number | null; alt: string | null; created_at: string };
        Insert: { id?: string; garment_id: string; cf_image_id: string; position?: number; bytes?: number; variants_ready?: boolean; width?: number | null; height?: number | null; alt?: string | null; created_at?: string };
        Update: { id?: string; garment_id?: string; cf_image_id?: string; position?: number; bytes?: number; variants_ready?: boolean; width?: number | null; height?: number | null; alt?: string | null; created_at?: string };
        Relationships: [];
      };
      garment_tags: {
        Row: { garment_id: string; tag_id: string };
        Insert: { garment_id: string; tag_id: string };
        Update: { garment_id?: string; tag_id?: string };
        Relationships: [];
      };
      catalog_runs: {
        Row: { id: string; brand_id: string; created_by: string | null; source_kind: "shop" | "csv"; origin: string | null; source_label: string; consent_confirmed: boolean; contact: string; options: Json; phase: "reading" | "photos" | "building" | "done" | "failed" | "discarded"; cursor: number; currency: string | null; products: Json; stats: Json; unknown_sizes: Json; is_complete: boolean; comparison: Json | null; package_keys: Json; imported_at: string | null; imported_by: string | null; import_stats: Json | null; actions: Json; error: string | null; expires_at: string; created_at: string; updated_at: string; finished_at: string | null };
        Insert: { id?: string; brand_id: string; created_by?: string | null; source_kind: "shop" | "csv"; origin?: string | null; source_label: string; consent_confirmed: boolean; contact: string; options: Json; phase: "reading" | "photos" | "building" | "done" | "failed" | "discarded"; cursor?: number; currency?: string | null; products?: Json; stats?: Json; unknown_sizes?: Json; is_complete?: boolean; comparison?: Json | null; package_keys?: Json; imported_at?: string | null; imported_by?: string | null; import_stats?: Json | null; actions?: Json; error?: string | null; expires_at?: string; created_at?: string; updated_at?: string; finished_at?: string | null };
        Update: { id?: string; brand_id?: string; created_by?: string | null; source_kind?: "shop" | "csv"; origin?: string | null; source_label?: string; consent_confirmed?: boolean; contact?: string; options?: Json; phase?: "reading" | "photos" | "building" | "done" | "failed" | "discarded"; cursor?: number; currency?: string | null; products?: Json; stats?: Json; unknown_sizes?: Json; is_complete?: boolean; comparison?: Json | null; package_keys?: Json; imported_at?: string | null; imported_by?: string | null; import_stats?: Json | null; actions?: Json; error?: string | null; expires_at?: string; created_at?: string; updated_at?: string; finished_at?: string | null };
        Relationships: [];
      };
      brand_tags: {
        Row: { brand_id: string; tag_id: string };
        Insert: { brand_id: string; tag_id: string };
        Update: { brand_id?: string; tag_id?: string };
        Relationships: [];
      };
      search_synonyms: {
        Row: { id: string; terms: string[]; created_at: string };
        Insert: { id?: string; terms: string[]; created_at?: string };
        Update: { id?: string; terms?: string[]; created_at?: string };
        Relationships: [];
      };
      search_stopwords: {
        Row: { word: string };
        Insert: { word: string };
        Update: { word?: string };
        Relationships: [];
      };
      garment_sizes: {
        Row: { garment_id: string; size_id: string };
        Insert: { garment_id: string; size_id: string };
        Update: { garment_id?: string; size_id?: string };
        Relationships: [];
      };
      posts: {
        Row: { id: string; author_type: Database["public"]["Enums"]["post_author_type"]; author_brand_id: string | null; author_user_id: string | null; caption: string | null; status: Database["public"]["Enums"]["post_status"]; popularity: number; published_at: string | null; moderation_locked: boolean; hidden_at: string | null; hidden_reason: string | null; reviewed_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; author_type: Database["public"]["Enums"]["post_author_type"]; author_brand_id?: string | null; author_user_id?: string | null; caption?: string | null; status?: Database["public"]["Enums"]["post_status"]; popularity?: number; published_at?: string | null; moderation_locked?: boolean; hidden_at?: string | null; hidden_reason?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; author_type?: Database["public"]["Enums"]["post_author_type"]; author_brand_id?: string | null; author_user_id?: string | null; caption?: string | null; status?: Database["public"]["Enums"]["post_status"]; popularity?: number; published_at?: string | null; moderation_locked?: boolean; hidden_at?: string | null; hidden_reason?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      post_images: {
        Row: { id: string; post_id: string; cf_image_id: string; position: number; bytes: number; variants_ready: boolean; width: number | null; height: number | null; created_at: string };
        Insert: { id?: string; post_id: string; cf_image_id: string; position?: number; bytes?: number; variants_ready?: boolean; width?: number | null; height?: number | null; created_at?: string };
        Update: { id?: string; post_id?: string; cf_image_id?: string; position?: number; bytes?: number; variants_ready?: boolean; width?: number | null; height?: number | null; created_at?: string };
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
      brand_stubs: {
        Row: { id: string; name: string; name_key: string; status: Database["public"]["Enums"]["brand_stub_status"]; claimed_brand_id: string | null; created_by_user_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; status?: Database["public"]["Enums"]["brand_stub_status"]; claimed_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; status?: Database["public"]["Enums"]["brand_stub_status"]; claimed_brand_id?: string | null; created_by_user_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      proposed_garments: {
        Row: { id: string; name: string; category_tag_id: string; brand_id: string | null; brand_stub_id: string | null; status: Database["public"]["Enums"]["proposed_garment_status"]; claimed_garment_id: string | null; created_by_user_id: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; category_tag_id: string; brand_id?: string | null; brand_stub_id?: string | null; status?: Database["public"]["Enums"]["proposed_garment_status"]; claimed_garment_id?: string | null; created_by_user_id: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; category_tag_id?: string; brand_id?: string | null; brand_stub_id?: string | null; status?: Database["public"]["Enums"]["proposed_garment_status"]; claimed_garment_id?: string | null; created_by_user_id?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      proposed_garment_colors: {
        Row: { proposed_garment_id: string; color_id: string };
        Insert: { proposed_garment_id: string; color_id: string };
        Update: { proposed_garment_id?: string; color_id?: string };
        Relationships: [];
      };
      post_proposed_items: {
        Row: { id: string; post_id: string; proposed_garment_id: string; position: number; position_x: number | null; position_y: number | null; created_at: string };
        Insert: { id?: string; post_id: string; proposed_garment_id: string; position?: number; position_x?: number | null; position_y?: number | null; created_at?: string };
        Update: { id?: string; post_id?: string; proposed_garment_id?: string; position?: number; position_x?: number | null; position_y?: number | null; created_at?: string };
        Relationships: [];
      };
      post_brand_mentions: {
        Row: { id: string; post_id: string; brand_id: string | null; brand_stub_id: string | null; created_at: string };
        Insert: { id?: string; post_id: string; brand_id?: string | null; brand_stub_id?: string | null; created_at?: string };
        Update: { id?: string; post_id?: string; brand_id?: string | null; brand_stub_id?: string | null; created_at?: string };
        Relationships: [];
      };
      content_reports: {
        Row: { id: string; reporter_user_id: string; target_type: Database["public"]["Enums"]["report_target"]; target_id: string; reason: Database["public"]["Enums"]["report_reason"]; note: string | null; status: Database["public"]["Enums"]["report_status"]; resolved_by: string | null; resolved_at: string | null; created_at: string };
        Insert: { id?: string; reporter_user_id: string; target_type: Database["public"]["Enums"]["report_target"]; target_id: string; reason: Database["public"]["Enums"]["report_reason"]; note?: string | null; status?: Database["public"]["Enums"]["report_status"]; resolved_by?: string | null; resolved_at?: string | null; created_at?: string };
        Update: { id?: string; reporter_user_id?: string; target_type?: Database["public"]["Enums"]["report_target"]; target_id?: string; reason?: Database["public"]["Enums"]["report_reason"]; note?: string | null; status?: Database["public"]["Enums"]["report_status"]; resolved_by?: string | null; resolved_at?: string | null; created_at?: string };
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
      brand_follows: {
        Row: { user_id: string; brand_id: string; created_at: string };
        Insert: { user_id: string; brand_id: string; created_at?: string };
        Update: { user_id?: string; brand_id?: string; created_at?: string };
        Relationships: [];
      };
      post_likes: {
        Row: { user_id: string; post_id: string; created_at: string };
        Insert: { user_id: string; post_id: string; created_at?: string };
        Update: { user_id?: string; post_id?: string; created_at?: string };
        Relationships: [];
      };
      garment_likes: {
        Row: { user_id: string; garment_id: string; created_at: string };
        Insert: { user_id: string; garment_id: string; created_at?: string };
        Update: { user_id?: string; garment_id?: string; created_at?: string };
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
          like_count: number;
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
      public_profiles: {
        Row: { id: string; handle: string; display_name: string; avatar_key: string | null; is_public: boolean; bio: string | null; link_url: string | null; city_slug: string | null; city_name: string | null; likes_visible: boolean; is_brand_account: boolean; created_at: string };
        Relationships: [];
      };
      feed_items: {
        Row: {
          kind: "post" | "garment";
          id: string;
          title: string | null;
          popularity: number;
          published_at: string | null;
          created_at: string;
          // Nulos en looks de usuario (spec 008). Nunca asumir que hay marca.
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          brand_verified: boolean | null;
          city_slug: string | null;
          city_name: string | null;
          image: string | null;
          image_width: number | null;
          image_height: number | null;
          occasions: string[];
          styles: string[];
          categories: string[];
          min_price: number | null;
          max_price: number | null;
          price_ranges: string[];
          score: number;
          like_count: number;
          colors: string[];
          author_type?: "brand" | "team" | "user" | null;
          author_user_id?: string | null;
          author_handle?: string | null;
          author_name?: string | null;
          author_avatar?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_id: { Args: Record<string, never>; Returns: string };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      check_storage_quota: { Args: { p_brand_id: string; p_bytes: number }; Returns: Json };
      check_user_storage_quota: { Args: { p_bytes: number }; Returns: Json };
      user_storage_bytes: { Args: { p_user_id: string }; Returns: number };
      get_or_create_brand_stub: { Args: { p_name: string }; Returns: Json };
      search_brand_mentions: {
        Args: { q: string };
        Returns: { kind: "brand" | "stub"; id: string; name: string; slug: string | null }[];
      };
      report_content: {
        Args: { p_target_type: Database["public"]["Enums"]["report_target"]; p_target_id: string; p_reason: Database["public"]["Enums"]["report_reason"]; p_note?: string | null };
        Returns: Json;
      };
      moderate_post: { Args: { p_post_id: string; p_action: "hide" | "restore" | "dismiss"; p_reason?: string | null }; Returns: undefined };
      set_user_posting_block: { Args: { p_user_id: string; p_blocked: boolean; p_reason?: string | null }; Returns: undefined };
      set_brand_stub_blocked: { Args: { p_stub_id: string; p_blocked: boolean }; Returns: undefined };
      stale_user_drafts: { Args: { p_days: number }; Returns: { post_id: string; image_key: string | null }[] };
      admin_blocked_users: {
        Args: Record<string, never>;
        Returns: { id: string; email: string | null; display_name: string | null; handle: string; posting_blocked_at: string; posting_blocked_reason: string | null }[];
      };
      user_look_stats: { Args: Record<string, never>; Returns: Json };
      is_my_editable_look: { Args: { p_post_id: string }; Returns: boolean };
      ugc_name_error: { Args: { p_name: string; p_min: number; p_max: number }; Returns: string | null };
      approve_brand: { Args: { p_brand_id: string }; Returns: { brand_name: string; owner_email: string | null }[] };
      reject_brand: { Args: { p_brand_id: string; p_note?: string | null }; Returns: { brand_name: string; owner_email: string | null }[] };
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
        Args: { q?: string | null; p_user_city?: string | null; p_styles?: string[] | null };
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
      search_terms: {
        Args: { q: string | null };
        Returns: { tok: string; alts: string[] }[];
      };
      search_matches: { Args: { p_txt: string; q: string }; Returns: boolean };
      tag_usage_counts: { Args: Record<string, never>; Returns: { tag_id: string; uses: number }[] };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      admin_list_users: {
        Args: { q?: string | null };
        Returns: {
          id: string;
          email: string | null;
          display_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          brand_id: string | null;
          brand_name: string | null;
          created_at: string;
        }[];
      };
      set_user_role: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      close_brand: { Args: { p_brand_id: string }; Returns: undefined };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      popular_content_tags: {
        Args: { p_limit?: number | null };
        Returns: { slug: string; name: string; type: string }[];
      };
      get_feed: {
        Args: {
          p_cities?: string[] | null;
          p_occasions?: string[] | null;
          p_styles?: string[] | null;
          p_categories?: string[] | null;
          p_prices?: string[] | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_colors?: string[] | null;
        };
        Returns: {
          kind: "post" | "garment";
          id: string;
          title: string | null;
          popularity: number;
          published_at: string | null;
          created_at: string;
          // Nulos en looks de usuario (spec 008). Nunca asumir que hay marca.
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          brand_verified: boolean | null;
          city_slug: string | null;
          city_name: string | null;
          image: string | null;
          image_width: number | null;
          image_height: number | null;
          occasions: string[];
          styles: string[];
          categories: string[];
          min_price: number | null;
          max_price: number | null;
          price_ranges: string[];
          score: number;
          like_count: number;
          colors: string[];
          author_type?: "brand" | "team" | "user" | null;
          author_user_id?: string | null;
          author_handle?: string | null;
          author_name?: string | null;
          author_avatar?: string | null;
        }[];
      };
      create_style_tag: {
        Args: { p_name: string };
        Returns: Database["public"]["Tables"]["tags"]["Row"][];
      };
      create_color: {
        Args: { p_name: string };
        Returns: Database["public"]["Tables"]["colors"]["Row"][];
      };
      vocab_name_error: { Args: { p_name: string }; Returns: string | null };
      search_by_embedding: {
        Args: {
          p_embedding: string;
          p_limit?: number | null;
          p_cities?: string[] | null;
          p_occasions?: string[] | null;
          p_styles?: string[] | null;
          p_categories?: string[] | null;
          p_prices?: string[] | null;
          p_colors?: string[] | null;
          p_prefer_category?: string | null;
        };
        Returns: { id: string; similarity: number }[];
      };
      photo_search_quota: { Args: { p_requester: string }; Returns: number };
      similar_garments: {
        Args: { p_garment_id: string; p_limit?: number | null; p_min?: number | null };
        Returns: { id: string; similarity: number }[];
      };
      visual_index_status: { Args: Record<string, never>; Returns: { status: string; n: number }[] };
      feed_style_counts: {
        Args: Record<string, never>;
        Returns: { slug: string; uses: number }[];
      };
      color_filter_options: {
        Args: Record<string, never>;
        Returns: { slug: string; name: string; hex: string | null; uses: number }[];
      };
    };
    Enums: {
      brand_status: "pending" | "active" | "rejected";
      user_role: "user" | "curator" | "admin" | "brand";
      price_range: "under_100k" | "100k_200k" | "200k_350k" | "350k_500k" | "over_500k";
      tag_type: "category" | "occasion" | "style" | "temperature";
      garment_status: "pending" | "published" | "archived";
      garment_source: "team" | "brand" | "user_proposed";
      post_author_type: "team" | "brand" | "user";
      post_status: "draft" | "published" | "archived";
      size_system: "alpha" | "numeric" | "special";
      brand_review_status: "pending" | "accepted" | "declined";
      brand_stub_status: "open" | "claimed" | "blocked";
      proposed_garment_status: "open" | "claimed" | "rejected";
      report_target: "post" | "profile" | "brand_review" | "proposed_garment";
      report_reason: "not_fashion" | "offensive" | "spam" | "stolen_photo" | "other";
      report_status: "open" | "actioned" | "dismissed";
      click_source: "feed" | "post" | "garment" | "brand_profile" | "photo_search" | "similar";
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
