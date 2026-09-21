export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			matches: {
				Row: {
					created_at: string;
					description: string | null;
					id: string;
					podcast_id: string;
					podcast_image_url: string | null;
					podcast_name: string;
					podcast_url: string;
					position: number;
					score: number;
					signup_id: string;
					standout_criterion: string | null;
					why: string;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: string;
					podcast_id: string;
					podcast_image_url?: string | null;
					podcast_name: string;
					podcast_url: string;
					position: number;
					score: number;
					signup_id: string;
					standout_criterion?: string | null;
					why: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: string;
					podcast_id?: string;
					podcast_image_url?: string | null;
					podcast_name?: string;
					podcast_url?: string;
					position?: number;
					score?: number;
					signup_id?: string;
					standout_criterion?: string | null;
					why?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'matches_signup_id_fkey';
						columns: ['signup_id'];
						isOneToOne: false;
						referencedRelation: 'signups';
						referencedColumns: ['id'];
					}
				];
			};
			sends: {
				Row: {
					created_at: string;
					error: string | null;
					id: string;
					kind: string;
					provider_id: string | null;
					signup_id: string;
					status: string;
				};
				Insert: {
					created_at?: string;
					error?: string | null;
					id?: string;
					kind: string;
					provider_id?: string | null;
					signup_id: string;
					status: string;
				};
				Update: {
					created_at?: string;
					error?: string | null;
					id?: string;
					kind?: string;
					provider_id?: string | null;
					signup_id?: string;
					status?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'sends_signup_id_fkey';
						columns: ['signup_id'];
						isOneToOne: false;
						referencedRelation: 'signups';
						referencedColumns: ['id'];
					}
				];
			};
			signups: {
				Row: {
					created_at: string;
					criteria: Json;
					email: string;
					id: string;
					is_active: boolean;
					persona: Json;
					persona_confidence: number | null;
					submitted_url: string;
					unsubscribe_token: string;
					updated_at: string;
					url_kind: string;
				};
				Insert: {
					created_at?: string;
					criteria: Json;
					email: string;
					id?: string;
					is_active?: boolean;
					persona: Json;
					persona_confidence?: number | null;
					submitted_url: string;
					unsubscribe_token?: string;
					updated_at?: string;
					url_kind: string;
				};
				Update: {
					created_at?: string;
					criteria?: Json;
					email?: string;
					id?: string;
					is_active?: boolean;
					persona?: Json;
					persona_confidence?: number | null;
					submitted_url?: string;
					unsubscribe_token?: string;
					updated_at?: string;
					url_kind?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {}
	}
} as const;
