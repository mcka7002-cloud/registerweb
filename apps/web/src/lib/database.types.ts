
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "attendance_teachers": {
                  Row: {
                    "class_session_id": string,"recorded_at": string,"recorded_by": string | null,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_session_id": string,"recorded_at"?: string,"recorded_by"?: string | null,"teacher_id": string
                  }
                  Update: {
                    "class_session_id"?: string,"recorded_at"?: string,"recorded_by"?: string | null,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_teachers_class_session_id_fkey"
      columns: ["class_session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_teachers_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attendances": {
                  Row: {
                    "booking_id": string | null,"branch_id": string,"class_session_id": string | null,"client_uuid": string,"id": string,"is_trial": boolean,"method": Database["public"]['Enums']["attendance_method"],"reason": string | null,"recorded_at": string,"recorded_by": string | null,"scanned_at": string,"source": Database["public"]['Enums']["attendance_source"],"student_id": string,"student_package_id": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"branch_id": string,"class_session_id"?: string | null,"client_uuid": string,"id"?: string,"is_trial"?: boolean,"method": Database["public"]['Enums']["attendance_method"],"reason"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"scanned_at": string,"source"?: Database["public"]['Enums']["attendance_source"],"student_id": string,"student_package_id"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "booking_id"?: string | null,"branch_id"?: string,"class_session_id"?: string | null,"client_uuid"?: string,"id"?: string,"is_trial"?: boolean,"method"?: Database["public"]['Enums']["attendance_method"],"reason"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"scanned_at"?: string,"source"?: Database["public"]['Enums']["attendance_source"],"student_id"?: string,"student_package_id"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendances_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_class_session_id_fkey"
      columns: ["class_session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_student_package_id_fkey"
      columns: ["student_package_id"]
isOneToOne: false
      referencedRelation: "student_packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"branch_id": string | null,"created_at": string,"data": Json | null,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"branch_id"?: string | null,"created_at"?: string,"data"?: Json | null,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"branch_id"?: string | null,"created_at"?: string,"data"?: Json | null,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"belt_history": {
                  Row: {
                    "changed_at": string,"changed_by": string,"exam_candidate_id": string | null,"from_rank": number | null,"id": string,"note": string | null,"student_id": string,"to_rank": number
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by": string,"exam_candidate_id"?: string | null,"from_rank"?: number | null,"id"?: string,"note"?: string | null,"student_id": string,"to_rank": number
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string,"exam_candidate_id"?: string | null,"from_rank"?: number | null,"id"?: string,"note"?: string | null,"student_id"?: string,"to_rank"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "belt_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "belt_history_exam_candidate_id_fkey"
      columns: ["exam_candidate_id"]
isOneToOne: false
      referencedRelation: "exam_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "belt_history_from_rank_fkey"
      columns: ["from_rank"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "belt_history_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "belt_history_to_rank_fkey"
      columns: ["to_rank"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    }
                  ]
                },"belt_ranks": {
                  Row: {
                    "classes_required": number,"dan": number | null,"gup": number | null,"id": number,"name_en": string,"name_th": string,"needs_admin_approval": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "classes_required": number,"dan"?: number | null,"gup"?: number | null,"id": number,"name_en": string,"name_th": string,"needs_admin_approval"?: boolean
                  }
                  Update: {
                    "classes_required"?: number,"dan"?: number | null,"gup"?: number | null,"id"?: number,"name_en"?: string,"name_th"?: string,"needs_admin_approval"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"bookings": {
                  Row: {
                    "branch_id": string,"class_session_id": string,"created_at": string,"created_by": string,"id": string,"is_makeup": boolean,"makeup_for_booking_id": string | null,"status": Database["public"]['Enums']["booking_status"],"student_id": string,"student_package_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"class_session_id": string,"created_at"?: string,"created_by": string,"id"?: string,"is_makeup"?: boolean,"makeup_for_booking_id"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"student_id": string,"student_package_id": string
                  }
                  Update: {
                    "branch_id"?: string,"class_session_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"is_makeup"?: boolean,"makeup_for_booking_id"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"student_id"?: string,"student_package_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_class_session_id_fkey"
      columns: ["class_session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_makeup_for_booking_id_fkey"
      columns: ["makeup_for_booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_student_package_id_fkey"
      columns: ["student_package_id"]
isOneToOne: false
      referencedRelation: "student_packages"
      referencedColumns: ["id"]
    }
                  ]
                },"branch_settings": {
                  Row: {
                    "branch_id": string,"updated_at": string,"vat_enabled": boolean,"vat_inclusive": boolean,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"updated_at"?: string,"vat_enabled"?: boolean,"vat_inclusive"?: boolean,"vat_rate"?: number
                  }
                  Update: {
                    "branch_id"?: string,"updated_at"?: string,"vat_enabled"?: boolean,"vat_inclusive"?: boolean,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "branch_settings_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: true
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "address": string | null,"code": string,"created_at": string,"id": string,"name": string,"open_hours": Json | null,"tax_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"code": string,"created_at"?: string,"id"?: string,"name": string,"open_hours"?: Json | null,"tax_id"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"open_hours"?: Json | null,"tax_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"checkin_review_queue": {
                  Row: {
                    "barcode": string,"branch_id": string,"client_uuid": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"problem": string,"scanned_at": string,"status": Database["public"]['Enums']["approval_status"],"student_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode": string,"branch_id": string,"client_uuid": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"problem": string,"scanned_at": string,"status"?: Database["public"]['Enums']["approval_status"],"student_id"?: string | null
                  }
                  Update: {
                    "barcode"?: string,"branch_id"?: string,"client_uuid"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"problem"?: string,"scanned_at"?: string,"status"?: Database["public"]['Enums']["approval_status"],"student_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkin_review_queue_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkin_review_queue_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkin_review_queue_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"class_schedules": {
                  Row: {
                    "branch_id": string,"capacity": number | null,"ends_at": string,"id": string,"is_active": boolean,"starts_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"capacity"?: number | null,"ends_at": string,"id"?: string,"is_active"?: boolean,"starts_at": string,"weekday": number
                  }
                  Update: {
                    "branch_id"?: string,"capacity"?: number | null,"ends_at"?: string,"id"?: string,"is_active"?: boolean,"starts_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_schedules_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"class_session_teachers": {
                  Row: {
                    "class_session_id": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_session_id": string,"teacher_id": string
                  }
                  Update: {
                    "class_session_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_session_teachers_class_session_id_fkey"
      columns: ["class_session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_session_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_sessions": {
                  Row: {
                    "branch_id": string,"cancelled": boolean,"capacity": number | null,"class_date": string,"ends_at": string,"id": string,"schedule_id": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"cancelled"?: boolean,"capacity"?: number | null,"class_date": string,"ends_at": string,"id"?: string,"schedule_id"?: string | null,"starts_at": string
                  }
                  Update: {
                    "branch_id"?: string,"cancelled"?: boolean,"capacity"?: number | null,"class_date"?: string,"ends_at"?: string,"id"?: string,"schedule_id"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_sessions_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["id"]
    }
                  ]
                },"competition_results": {
                  Row: {
                    "category": string,"competition_id": string,"id": string,"publish": boolean,"result": Database["public"]['Enums']["medal"],"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"competition_id": string,"id"?: string,"publish"?: boolean,"result": Database["public"]['Enums']["medal"],"student_id": string
                  }
                  Update: {
                    "category"?: string,"competition_id"?: string,"id"?: string,"publish"?: boolean,"result"?: Database["public"]['Enums']["medal"],"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competition_results_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competition_results_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"competition_teachers": {
                  Row: {
                    "competition_id": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "competition_id": string,"teacher_id": string
                  }
                  Update: {
                    "competition_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competition_teachers_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competition_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"competitions": {
                  Row: {
                    "created_at": string,"created_by": string,"event_date": string,"id": string,"location": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"event_date": string,"id"?: string,"location"?: string | null,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"event_date"?: string,"id"?: string,"location"?: string | null,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competitions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"data_requests": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"processed_at": string | null,"processed_by": string | null,"requested_by": string,"status": Database["public"]['Enums']["approval_status"],"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"processed_at"?: string | null,"processed_by"?: string | null,"requested_by": string,"status"?: Database["public"]['Enums']["approval_status"],"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"processed_at"?: string | null,"processed_by"?: string | null,"requested_by"?: string,"status"?: Database["public"]['Enums']["approval_status"],"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_requests_processed_by_fkey"
      columns: ["processed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_requests_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"document_sequences": {
                  Row: {
                    "branch_id": string,"doc_type": Database["public"]['Enums']["doc_type"],"last_no": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"doc_type": Database["public"]['Enums']["doc_type"],"last_no"?: number,"year": number
                  }
                  Update: {
                    "branch_id"?: string,"doc_type"?: Database["public"]['Enums']["doc_type"],"last_no"?: number,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_sequences_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "branch_id": string,"customer_address": string | null,"customer_name": string,"customer_tax_id": string | null,"doc_no": string,"doc_type": Database["public"]['Enums']["doc_type"],"id": string,"issued_at": string,"issued_by": string | null,"order_id": string,"status": Database["public"]['Enums']["doc_status"],"subtotal": number,"total": number,"vat_amount": number,"vat_inclusive": boolean,"vat_rate": number,"void_reason": string | null,"void_requested_by": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"customer_address"?: string | null,"customer_name": string,"customer_tax_id"?: string | null,"doc_no": string,"doc_type": Database["public"]['Enums']["doc_type"],"id"?: string,"issued_at"?: string,"issued_by"?: string | null,"order_id": string,"status"?: Database["public"]['Enums']["doc_status"],"subtotal": number,"total": number,"vat_amount"?: number,"vat_inclusive"?: boolean,"vat_rate"?: number,"void_reason"?: string | null,"void_requested_by"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "branch_id"?: string,"customer_address"?: string | null,"customer_name"?: string,"customer_tax_id"?: string | null,"doc_no"?: string,"doc_type"?: Database["public"]['Enums']["doc_type"],"id"?: string,"issued_at"?: string,"issued_by"?: string | null,"order_id"?: string,"status"?: Database["public"]['Enums']["doc_status"],"subtotal"?: number,"total"?: number,"vat_amount"?: number,"vat_inclusive"?: boolean,"vat_rate"?: number,"void_reason"?: string | null,"void_requested_by"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_void_requested_by_fkey"
      columns: ["void_requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_candidates": {
                  Row: {
                    "admin_approved_by": string | null,"exam_round_id": string,"free_retake": boolean,"from_rank": number,"id": string,"passed": boolean | null,"prelim_passed_at": string,"prelim_passed_by": string,"retake_of": string | null,"student_id": string,"to_rank": number,"wants_photo": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_approved_by"?: string | null,"exam_round_id": string,"free_retake"?: boolean,"from_rank": number,"id"?: string,"passed"?: boolean | null,"prelim_passed_at"?: string,"prelim_passed_by": string,"retake_of"?: string | null,"student_id": string,"to_rank": number,"wants_photo"?: boolean
                  }
                  Update: {
                    "admin_approved_by"?: string | null,"exam_round_id"?: string,"free_retake"?: boolean,"from_rank"?: number,"id"?: string,"passed"?: boolean | null,"prelim_passed_at"?: string,"prelim_passed_by"?: string,"retake_of"?: string | null,"student_id"?: string,"to_rank"?: number,"wants_photo"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_candidates_admin_approved_by_fkey"
      columns: ["admin_approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_exam_round_id_fkey"
      columns: ["exam_round_id"]
isOneToOne: false
      referencedRelation: "exam_rounds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_from_rank_fkey"
      columns: ["from_rank"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_prelim_passed_by_fkey"
      columns: ["prelim_passed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_retake_of_fkey"
      columns: ["retake_of"]
isOneToOne: false
      referencedRelation: "exam_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_candidates_to_rank_fkey"
      columns: ["to_rank"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_results": {
                  Row: {
                    "candidate_id": string,"id": string,"passed": boolean | null,"scored_by": string | null,"sort_order": number,"topic_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"id"?: string,"passed"?: boolean | null,"scored_by"?: string | null,"sort_order"?: number,"topic_name": string
                  }
                  Update: {
                    "candidate_id"?: string,"id"?: string,"passed"?: boolean | null,"scored_by"?: string | null,"sort_order"?: number,"topic_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_results_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "exam_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_results_scored_by_fkey"
      columns: ["scored_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_rounds": {
                  Row: {
                    "branch_id": string,"created_by": string,"exam_date": string,"id": string,"status": Database["public"]['Enums']["exam_round_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_by": string,"exam_date": string,"id"?: string,"status"?: Database["public"]['Enums']["exam_round_status"]
                  }
                  Update: {
                    "branch_id"?: string,"created_by"?: string,"exam_date"?: string,"id"?: string,"status"?: Database["public"]['Enums']["exam_round_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_rounds_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_rounds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_topics": {
                  Row: {
                    "from_rank": number,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "from_rank": number,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "from_rank"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_topics_from_rank_fkey"
      columns: ["from_rank"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    }
                  ]
                },"guardians": {
                  Row: {
                    "account_id": string | null,"full_name": string,"id": string,"nickname": string | null,"phones": (string)[],"relation": string,"sort_order": number,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"full_name": string,"id"?: string,"nickname"?: string | null,"phones": (string)[],"relation": string,"sort_order"?: number,"student_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"full_name"?: string,"id"?: string,"nickname"?: string | null,"phones"?: (string)[],"relation"?: string,"sort_order"?: number,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardians_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardians_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "branch_id": string | null,"holiday_date": string,"id": string,"name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"holiday_date": string,"id"?: string,"name"?: string | null
                  }
                  Update: {
                    "branch_id"?: string | null,"holiday_date"?: string,"id"?: string,"name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "holidays_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"expires_on": string,"id": string,"kind": string,"order_item_id": string | null,"starts_on": string,"student_id": string,"waive_reason": string | null,"waived_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_on": string,"id"?: string,"kind": string,"order_item_id"?: string | null,"starts_on": string,"student_id": string,"waive_reason"?: string | null,"waived_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_on"?: string,"id"?: string,"kind"?: string,"order_item_id"?: string | null,"starts_on"?: string,"student_id"?: string,"waive_reason"?: string | null,"waived_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_item_fk"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_waived_by_fkey"
      columns: ["waived_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "channel": Database["public"]['Enums']["notify_channel"],"created_at": string,"dedupe_key": string | null,"error": string | null,"id": number,"payload": NonNullable<Json>,"sent_at": string | null,"template": string,"to_address": string,"to_profile": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["public"]['Enums']["notify_channel"],"created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"id"?: never,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"template": string,"to_address": string,"to_profile"?: string | null
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["notify_channel"],"created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"id"?: never,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"template"?: string,"to_address"?: string,"to_profile"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_to_profile_fkey"
      columns: ["to_profile"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "amount": number,"description": string,"discount": number,"exam_candidate_id": string | null,"id": string,"item_type": Database["public"]['Enums']["order_item_type"],"order_id": string,"package_template_id": string | null,"product_variant_id": string | null,"qty": number,"student_id": string | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"description": string,"discount"?: number,"exam_candidate_id"?: string | null,"id"?: string,"item_type": Database["public"]['Enums']["order_item_type"],"order_id": string,"package_template_id"?: string | null,"product_variant_id"?: string | null,"qty"?: number,"student_id"?: string | null,"unit_price": number
                  }
                  Update: {
                    "amount"?: number,"description"?: string,"discount"?: number,"exam_candidate_id"?: string | null,"id"?: string,"item_type"?: Database["public"]['Enums']["order_item_type"],"order_id"?: string,"package_template_id"?: string | null,"product_variant_id"?: string | null,"qty"?: number,"student_id"?: string | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_exam_fk"
      columns: ["exam_candidate_id"]
isOneToOne: false
      referencedRelation: "exam_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_package_template_id_fkey"
      columns: ["package_template_id"]
isOneToOne: false
      referencedRelation: "package_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_fk"
      columns: ["product_variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "account_id": string | null,"branch_id": string,"created_at": string,"created_by": string,"discount": number,"id": string,"promotion_id": string | null,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"slip_path": string | null,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"vat_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"branch_id": string,"created_at"?: string,"created_by": string,"discount"?: number,"id"?: string,"promotion_id"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slip_path"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"vat_amount"?: number
                  }
                  Update: {
                    "account_id"?: string | null,"branch_id"?: string,"created_at"?: string,"created_by"?: string,"discount"?: number,"id"?: string,"promotion_id"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slip_path"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"vat_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_promotion_id_fkey"
      columns: ["promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"package_templates": {
                  Row: {
                    "branch_id": string | null,"created_at": string,"duration_days": number,"id": string,"is_active": boolean,"makeup_allowed": number,"name": string,"price": number,"sessions": number | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"created_at"?: string,"duration_days": number,"id"?: string,"is_active"?: boolean,"makeup_allowed"?: number,"name": string,"price": number,"sessions"?: number | null,"sort_order"?: number
                  }
                  Update: {
                    "branch_id"?: string | null,"created_at"?: string,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"makeup_allowed"?: number,"name"?: string,"price"?: number,"sessions"?: number | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "package_templates_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"branch_id": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"paid_at": string,"received_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"branch_id": string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"paid_at"?: string,"received_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"branch_id"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"order_id"?: string,"paid_at"?: string,"received_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payroll_adjustments": {
                  Row: {
                    "amount": number,"approval": Database["public"]['Enums']["approval_status"],"approved_by": string | null,"created_at": string,"created_by": string,"id": string,"note": string,"payroll_run_id": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approval"?: Database["public"]['Enums']["approval_status"],"approved_by"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"note": string,"payroll_run_id": string,"teacher_id": string
                  }
                  Update: {
                    "amount"?: number,"approval"?: Database["public"]['Enums']["approval_status"],"approved_by"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"note"?: string,"payroll_run_id"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_adjustments_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_adjustments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_adjustments_payroll_run_id_fkey"
      columns: ["payroll_run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_adjustments_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payroll_items": {
                  Row: {
                    "absent_days": number,"adjustment_amount": number,"base_amount": number,"deduction_amount": number,"net_amount": number,"payroll_run_id": string,"teacher_id": string,"weekend_amount": number,"weekend_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "absent_days"?: number,"adjustment_amount"?: number,"base_amount": number,"deduction_amount"?: number,"net_amount": number,"payroll_run_id": string,"teacher_id": string,"weekend_amount"?: number,"weekend_days"?: number
                  }
                  Update: {
                    "absent_days"?: number,"adjustment_amount"?: number,"base_amount"?: number,"deduction_amount"?: number,"net_amount"?: number,"payroll_run_id"?: string,"teacher_id"?: string,"weekend_amount"?: number,"weekend_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_items_payroll_run_id_fkey"
      columns: ["payroll_run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_items_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payroll_runs": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"id": string,"paid_at": string | null,"paid_by": string | null,"period_month": string,"status": Database["public"]['Enums']["payroll_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"id"?: string,"paid_at"?: string | null,"paid_by"?: string | null,"period_month": string,"status"?: Database["public"]['Enums']["payroll_status"]
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"id"?: string,"paid_at"?: string | null,"paid_by"?: string | null,"period_month"?: string,"status"?: Database["public"]['Enums']["payroll_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_runs_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_runs_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "id": string,"path": string,"post_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"path": string,"post_id": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"path"?: string,"post_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "approved_by": string | null,"author_id": string,"body_en": string | null,"body_th": string | null,"branch_id": string | null,"competition_id": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["post_kind"],"published_at": string | null,"status": Database["public"]['Enums']["post_status"],"title_en": string | null,"title_th": string,"visibility": Database["public"]['Enums']["post_visibility"],"youtube_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_by"?: string | null,"author_id": string,"body_en"?: string | null,"body_th"?: string | null,"branch_id"?: string | null,"competition_id"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["post_kind"],"published_at"?: string | null,"status"?: Database["public"]['Enums']["post_status"],"title_en"?: string | null,"title_th": string,"visibility"?: Database["public"]['Enums']["post_visibility"],"youtube_url"?: string | null
                  }
                  Update: {
                    "approved_by"?: string | null,"author_id"?: string,"body_en"?: string | null,"body_th"?: string | null,"branch_id"?: string | null,"competition_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["post_kind"],"published_at"?: string | null,"status"?: Database["public"]['Enums']["post_status"],"title_en"?: string | null,"title_th"?: string,"visibility"?: Database["public"]['Enums']["post_visibility"],"youtube_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    }
                  ]
                },"price_settings": {
                  Row: {
                    "amount": number,"branch_id": string | null,"id": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"branch_id"?: string | null,"id"?: string,"key": string
                  }
                  Update: {
                    "amount"?: number,"branch_id"?: string | null,"id"?: string,"key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_settings_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "id": string,"price": number,"product_id": string,"size": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"price": number,"product_id": string,"size": string
                  }
                  Update: {
                    "id"?: string,"price"?: number,"product_id"?: string,"size"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "category"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profile_branches": {
                  Row: {
                    "branch_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"profile_id": string
                  }
                  Update: {
                    "branch_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_branches_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_branches_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"line_user_id": string | null,"locale": string,"notify_channels": (Database["public"]['Enums']["notify_channel"])[],"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name": string,"id": string,"line_user_id"?: string | null,"locale"?: string,"notify_channels"?: (Database["public"]['Enums']["notify_channel"])[],"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"line_user_id"?: string | null,"locale"?: string,"notify_channels"?: (Database["public"]['Enums']["notify_channel"])[],"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "applies_to_membership": boolean,"applies_to_products": boolean,"branch_id": string | null,"code": string | null,"ends_on": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["promo_kind"],"name": string,"starts_on": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "applies_to_membership"?: boolean,"applies_to_products"?: boolean,"branch_id"?: string | null,"code"?: string | null,"ends_on": string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["promo_kind"],"name": string,"starts_on": string,"value": number
                  }
                  Update: {
                    "applies_to_membership"?: boolean,"applies_to_products"?: boolean,"branch_id"?: string | null,"code"?: string | null,"ends_on"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["promo_kind"],"name"?: string,"starts_on"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"registrations": {
                  Row: {
                    "account_id": string | null,"branch_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"pdpa_consent": boolean,"publish_consent": boolean,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["registration_status"],"student_id": string | null,"trial_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"branch_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"pdpa_consent": boolean,"publish_consent"?: boolean,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["registration_status"],"student_id"?: string | null,"trial_at"?: string | null
                  }
                  Update: {
                    "account_id"?: string | null,"branch_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"pdpa_consent"?: boolean,"publish_consent"?: boolean,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["registration_status"],"student_id"?: string | null,"trial_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "registrations_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_student_fk"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"review_queue": {
                  Row: {
                    "action": string,"actor_id": string,"branch_id": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"entity": string,"entity_id": string,"id": string,"requires_approval": boolean,"status": Database["public"]['Enums']["approval_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"branch_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"entity": string,"entity_id": string,"id"?: string,"requires_approval"?: boolean,"status"?: Database["public"]['Enums']["approval_status"]
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"branch_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"entity"?: string,"entity_id"?: string,"id"?: string,"requires_approval"?: boolean,"status"?: Database["public"]['Enums']["approval_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_queue_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_queue_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_queue_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_levels": {
                  Row: {
                    "branch_id": string,"qty": number,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"qty"?: number,"variant_id": string
                  }
                  Update: {
                    "branch_id"?: string,"qty"?: number,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_levels_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_levels_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "branch_id": string,"created_at": string,"created_by": string | null,"id": string,"order_item_id": string | null,"qty_change": number,"reason": string,"transfer_id": string | null,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_item_id"?: string | null,"qty_change": number,"reason": string,"transfer_id"?: string | null,"variant_id": string
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_item_id"?: string | null,"qty_change"?: number,"reason"?: string,"transfer_id"?: string | null,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"student_accounts": {
                  Row: {
                    "account_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"student_id": string
                  }
                  Update: {
                    "account_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_accounts_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_accounts_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_code_sequences": {
                  Row: {
                    "branch_id": string,"last_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"last_no"?: number
                  }
                  Update: {
                    "branch_id"?: string,"last_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_code_sequences_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: true
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"student_packages": {
                  Row: {
                    "bonus_sessions": number,"branch_id": string,"created_at": string,"duration_days": number,"expires_on": string | null,"id": string,"makeup_allowed": number,"makeup_used": number,"must_start_by": string,"name": string,"order_item_id": string | null,"paid_on": string,"price": number,"queue_after": string | null,"sessions_total": number | null,"sessions_used": number,"starts_on": string | null,"status": Database["public"]['Enums']["package_status"],"student_id": string,"template_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bonus_sessions"?: number,"branch_id": string,"created_at"?: string,"duration_days": number,"expires_on"?: string | null,"id"?: string,"makeup_allowed"?: number,"makeup_used"?: number,"must_start_by": string,"name": string,"order_item_id"?: string | null,"paid_on": string,"price": number,"queue_after"?: string | null,"sessions_total"?: number | null,"sessions_used"?: number,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["package_status"],"student_id": string,"template_id"?: string | null
                  }
                  Update: {
                    "bonus_sessions"?: number,"branch_id"?: string,"created_at"?: string,"duration_days"?: number,"expires_on"?: string | null,"id"?: string,"makeup_allowed"?: number,"makeup_used"?: number,"must_start_by"?: string,"name"?: string,"order_item_id"?: string | null,"paid_on"?: string,"price"?: number,"queue_after"?: string | null,"sessions_total"?: number | null,"sessions_used"?: number,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["package_status"],"student_id"?: string,"template_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_packages_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packages_item_fk"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packages_queue_after_fkey"
      columns: ["queue_after"]
isOneToOne: false
      referencedRelation: "student_packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packages_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packages_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "package_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "anonymized_at": string | null,"belt_rank_id": number,"birth_date": string,"branch_id": string,"code": string,"created_at": string,"emergency_name": string | null,"emergency_phone": string | null,"exam_counter": number,"exam_eligible_at": string | null,"first_name": string,"first_name_en": string,"gender": string | null,"height_cm": number | null,"id": string,"last_name": string,"last_name_en": string,"medical_notes": string | null,"membership_expires_on": string | null,"nickname": string | null,"pdpa_consent_at": string | null,"photo_path": string | null,"publish_consent": boolean,"status": Database["public"]['Enums']["student_status"],"trial_used_at": string | null,"uniform_size": string | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"belt_rank_id"?: number,"birth_date": string,"branch_id": string,"code": string,"created_at"?: string,"emergency_name"?: string | null,"emergency_phone"?: string | null,"exam_counter"?: number,"exam_eligible_at"?: string | null,"first_name": string,"first_name_en": string,"gender"?: string | null,"height_cm"?: number | null,"id"?: string,"last_name": string,"last_name_en": string,"medical_notes"?: string | null,"membership_expires_on"?: string | null,"nickname"?: string | null,"pdpa_consent_at"?: string | null,"photo_path"?: string | null,"publish_consent"?: boolean,"status"?: Database["public"]['Enums']["student_status"],"trial_used_at"?: string | null,"uniform_size"?: string | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "anonymized_at"?: string | null,"belt_rank_id"?: number,"birth_date"?: string,"branch_id"?: string,"code"?: string,"created_at"?: string,"emergency_name"?: string | null,"emergency_phone"?: string | null,"exam_counter"?: number,"exam_eligible_at"?: string | null,"first_name"?: string,"first_name_en"?: string,"gender"?: string | null,"height_cm"?: number | null,"id"?: string,"last_name"?: string,"last_name_en"?: string,"medical_notes"?: string | null,"membership_expires_on"?: string | null,"nickname"?: string | null,"pdpa_consent_at"?: string | null,"photo_path"?: string | null,"publish_consent"?: boolean,"status"?: Database["public"]['Enums']["student_status"],"trial_used_at"?: string | null,"uniform_size"?: string | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_belt_rank_id_fkey"
      columns: ["belt_rank_id"]
isOneToOne: false
      referencedRelation: "belt_ranks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_day_claims": {
                  Row: {
                    "branch_id": string,"created_at": string,"id": string,"note": string | null,"teacher_id": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"id"?: string,"note"?: string | null,"teacher_id": string,"work_date": string
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"id"?: string,"note"?: string | null,"teacher_id"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_day_claims_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_day_claims_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_days": {
                  Row: {
                    "branch_id": string,"claimed": boolean,"classes_assigned": number,"classes_taught": number,"id": string,"payroll_run_id": string,"resolve_note": string | null,"resolved_by": string | null,"resolved_result": string | null,"result": string,"teacher_id": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"claimed": boolean,"classes_assigned": number,"classes_taught": number,"id"?: string,"payroll_run_id": string,"resolve_note"?: string | null,"resolved_by"?: string | null,"resolved_result"?: string | null,"result": string,"teacher_id": string,"work_date": string
                  }
                  Update: {
                    "branch_id"?: string,"claimed"?: boolean,"classes_assigned"?: number,"classes_taught"?: number,"id"?: string,"payroll_run_id"?: string,"resolve_note"?: string | null,"resolved_by"?: string | null,"resolved_result"?: string | null,"result"?: string,"teacher_id"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_days_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_days_payroll_run_id_fkey"
      columns: ["payroll_run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_days_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_days_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teachers": {
                  Row: {
                    "absence_deduction": number,"daily_rate": number | null,"employment_status": Database["public"]['Enums']["employment_status"],"monthly_salary": number | null,"permanent_from": string | null,"profile_id": string,"weekend_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "absence_deduction"?: number,"daily_rate"?: number | null,"employment_status"?: Database["public"]['Enums']["employment_status"],"monthly_salary"?: number | null,"permanent_from"?: string | null,"profile_id": string,"weekend_rate"?: number
                  }
                  Update: {
                    "absence_deduction"?: number,"daily_rate"?: number | null,"employment_status"?: Database["public"]['Enums']["employment_status"],"monthly_salary"?: number | null,"permanent_from"?: string | null,"profile_id"?: string,"weekend_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "teachers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "amount": number,"branch_id": string,"category": string,"created_at": string,"created_by": string | null,"description": string | null,"document_id": string | null,"id": string,"occurred_on": string,"payroll_run_id": string | null,"receipt_path": string | null,"type": Database["public"]['Enums']["txn_type"],"vat_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"branch_id": string,"category": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"document_id"?: string | null,"id"?: string,"occurred_on": string,"payroll_run_id"?: string | null,"receipt_path"?: string | null,"type": Database["public"]['Enums']["txn_type"],"vat_amount"?: number
                  }
                  Update: {
                    "amount"?: number,"branch_id"?: string,"category"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"document_id"?: string | null,"id"?: string,"occurred_on"?: string,"payroll_run_id"?: string | null,"receipt_path"?: string | null,"type"?: Database["public"]['Enums']["txn_type"],"vat_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_payroll_run_id_fkey"
      columns: ["payroll_run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"uniform_sizes": {
                  Row: {
                    "collar": string,"height_max": number,"height_min": number,"label": string,"size": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collar": string,"height_max": number,"height_min": number,"label": string,"size": string
                  }
                  Update: {
                    "collar"?: string,"height_max"?: number,"height_min"?: number,"label"?: string,"size"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "approve_registration":
{ Args: { "p_registration": string,"p_student": Json }; Returns: Json
                           },
"bkk_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"book_sessions":
{ Args: { "p_package": string,"p_sessions": (string)[] }; Returns: Json
                           },
"build_teacher_days":
{ Args: { "p_run": string }; Returns: number
                           },
"cancel_booking":
{ Args: { "p_booking": string }; Returns: Json
                           },
"compute_vat":
{ Args: { "enabled": boolean,"inclusive": boolean,"price": number,"rate": number }; Returns: {
              "net": number,"total": number,"vat": number
            }[]
                           },
"exam_eligible":
{ Args: { "s": string }; Returns: boolean
                           },
"generate_class_sessions":
{ Args: { "p_branch": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"has_branch":
{ Args: { "b": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_manager":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"membership_active":
{ Args: { "on_date"?: string,"s": string }; Returns: boolean
                           },
"membership_next_expiry":
{ Args: { "current_expiry": string,"paid_on": string }; Returns: string
                           },
"my_home":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"nightly_job":
{ Args: { "p_today"?: string }; Returns: undefined
                           },
"owns_student":
{ Args: { "s": string }; Returns: boolean
                           },
"record_checkin":
{ Args: { "p_barcode": string,"p_branch": string,"p_class_session": string,"p_client_uuid": string,"p_method"?: Database["public"]['Enums']["attendance_method"],"p_reason"?: string,"p_scanned_at": string,"p_source"?: Database["public"]['Enums']["attendance_source"] }; Returns: Json
                           },
"reject_registration":
{ Args: { "p_reason": string,"p_registration": string }; Returns: Json
                           },
"sell_package":
{ Args: { "p_method": Database["public"]['Enums']["payment_method"],"p_student": string,"p_template": string,"p_with_membership": boolean }; Returns: Json
                           },
"staff_sees_profile":
{ Args: { "p": string }; Returns: boolean
                           },
"staff_sees_student":
{ Args: { "s": string }; Returns: boolean
                           },
"update_student":
{ Args: { "p_fields": Json,"p_student": string }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "admin"|"branch_manager"|"teacher"|"customer"|"kiosk","approval_status": "pending"|"approved"|"rejected","attendance_method": "scan"|"manual","attendance_source": "online"|"offline_sync","booking_status": "booked"|"attended"|"absent"|"cancelled","doc_status": "issued"|"void","doc_type": "receipt"|"tax_invoice","employment_status": "probation"|"permanent","exam_round_status": "open"|"scored"|"closed","medal": "gold"|"silver"|"bronze"|"participant","notify_channel": "email"|"line","order_item_type": "package"|"membership"|"membership_renewal"|"product"|"exam_fee"|"exam_photo"|"card_fee","order_status": "draft"|"pending_review"|"approved"|"rejected","package_status": "active"|"expired","payment_method": "cash"|"transfer"|"promptpay"|"slip","payroll_status": "open"|"closed"|"paid","post_kind": "news"|"album"|"video"|"achievement","post_status": "draft"|"pending"|"published"|"archived","post_visibility": "public"|"customers","promo_kind": "percent"|"amount"|"sibling"|"bonus_sessions"|"multi_month","registration_status": "pending"|"trial_booked"|"approved"|"rejected","student_status": "active"|"inactive","txn_type": "income"|"expense"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "branch_manager", "teacher", "customer", "kiosk"],"approval_status": ["pending", "approved", "rejected"],"attendance_method": ["scan", "manual"],"attendance_source": ["online", "offline_sync"],"booking_status": ["booked", "attended", "absent", "cancelled"],"doc_status": ["issued", "void"],"doc_type": ["receipt", "tax_invoice"],"employment_status": ["probation", "permanent"],"exam_round_status": ["open", "scored", "closed"],"medal": ["gold", "silver", "bronze", "participant"],"notify_channel": ["email", "line"],"order_item_type": ["package", "membership", "membership_renewal", "product", "exam_fee", "exam_photo", "card_fee"],"order_status": ["draft", "pending_review", "approved", "rejected"],"package_status": ["active", "expired"],"payment_method": ["cash", "transfer", "promptpay", "slip"],"payroll_status": ["open", "closed", "paid"],"post_kind": ["news", "album", "video", "achievement"],"post_status": ["draft", "pending", "published", "archived"],"post_visibility": ["public", "customers"],"promo_kind": ["percent", "amount", "sibling", "bonus_sessions", "multi_month"],"registration_status": ["pending", "trial_booked", "approved", "rejected"],"student_status": ["active", "inactive"],"txn_type": ["income", "expense"]
          }
        }
} as const
