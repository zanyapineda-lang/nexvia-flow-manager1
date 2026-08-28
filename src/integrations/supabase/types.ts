export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cierres_contables: {
        Row: {
          archivos: Json
          created_at: string
          estado: string
          id: string
          notas: string | null
          periodo: string
          total_egresos: number
          total_ingresos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archivos?: Json
          created_at?: string
          estado?: string
          id?: string
          notas?: string | null
          periodo: string
          total_egresos?: number
          total_ingresos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archivos?: Json
          created_at?: string
          estado?: string
          id?: string
          notas?: string | null
          periodo?: string
          total_egresos?: number
          total_ingresos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ciudad: string | null
          codigo_smpp: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nit: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ciudad?: string | null
          codigo_smpp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nit?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ciudad?: string | null
          codigo_smpp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nit?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      factura_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          factura_id: string
          id: string
          orden: number
          precio_unitario: number
          total: number
          user_id: string
        }
        Insert: {
          cantidad?: number
          created_at?: string
          descripcion: string
          factura_id: string
          id?: string
          orden?: number
          precio_unitario?: number
          total?: number
          user_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          factura_id?: string
          id?: string
          orden?: number
          precio_unitario?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_items_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          cliente_id: string | null
          cliente_snapshot: Json | null
          created_at: string
          estado: string
          fecha: string
          fecha_vencimiento: string | null
          id: string
          iva: number
          moneda: string
          notas: string | null
          numero: string
          subtotal: number
          tipo: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          created_at?: string
          estado?: string
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          iva?: number
          moneda?: string
          notas?: string | null
          numero: string
          subtotal?: number
          tipo?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          created_at?: string
          estado?: string
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          iva?: number
          moneda?: string
          notas?: string | null
          numero?: string
          subtotal?: number
          tipo?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      mdr_datasets: {
        Row: {
          cliente_id: string | null
          created_at: string
          fecha_desde: string | null
          fecha_hasta: string | null
          id: string
          nombre: string
          notas: string | null
          resumen: Json
          tipo: string
          total_delivered: number
          total_failed: number
          total_in: number
          total_out: number
          total_registros: number
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          fecha_desde?: string | null
          fecha_hasta?: string | null
          id?: string
          nombre: string
          notas?: string | null
          resumen?: Json
          tipo?: string
          total_delivered?: number
          total_failed?: number
          total_in?: number
          total_out?: number
          total_registros?: number
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          fecha_desde?: string | null
          fecha_hasta?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          resumen?: Json
          tipo?: string
          total_delivered?: number
          total_failed?: number
          total_in?: number
          total_out?: number
          total_registros?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdr_datasets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_contables: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          created_at: string
          descripcion: string
          factura_id: string | null
          fecha: string
          id: string
          moneda: string
          monto: number
          notas: string | null
          soporte_mime: string | null
          soporte_path: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          descripcion: string
          factura_id?: string | null
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          notas?: string | null
          soporte_mime?: string | null
          soporte_path?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          descripcion?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          notas?: string | null
          soporte_mime?: string | null
          soporte_path?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_contables_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      soportes_pago: {
        Row: {
          cliente_id: string | null
          created_at: string
          factura_id: string | null
          fecha: string | null
          id: string
          mime_type: string | null
          monto: number | null
          nombre_archivo: string
          notas: string | null
          storage_path: string
          tamano_bytes: number | null
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          factura_id?: string | null
          fecha?: string | null
          id?: string
          mime_type?: string | null
          monto?: number | null
          nombre_archivo: string
          notas?: string | null
          storage_path: string
          tamano_bytes?: number | null
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          factura_id?: string | null
          fecha?: string | null
          id?: string
          mime_type?: string | null
          monto?: number | null
          nombre_archivo?: string
          notas?: string | null
          storage_path?: string
          tamano_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soportes_pago_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soportes_pago_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
