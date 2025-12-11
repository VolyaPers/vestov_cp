--
-- PostgreSQL database dump
--

\restrict dTL13PCXqovPaDnhM5Pm8arVA8eZebrSdvS9dvzdSwE8shOPKJIvd8ayGtTXwjW

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: volodymyrshapovalov
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO volodymyrshapovalov;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: volodymyrshapovalov
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO volodymyrshapovalov;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: volodymyrshapovalov
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE drizzle.__drizzle_migrations_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: volodymyrshapovalov
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: client_contacts; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.client_contacts (
    id integer NOT NULL,
    client_id integer NOT NULL,
    full_name text NOT NULL,
    "position" text,
    email character varying(255),
    phone character varying(20),
    notes text,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_contacts OWNER TO volodymyrshapovalov;

--
-- Name: client_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.client_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.client_contacts_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: client_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.client_contacts_id_seq OWNED BY public.client_contacts.id;


--
-- Name: client_service_developers; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.client_service_developers (
    id integer NOT NULL,
    client_service_id integer NOT NULL,
    developer_id integer NOT NULL,
    employment_type character varying(20) NOT NULL,
    hourly_rate numeric(10,2),
    fixed_price numeric(10,2),
    is_active boolean DEFAULT true,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    work_schedule jsonb
);


ALTER TABLE public.client_service_developers OWNER TO volodymyrshapovalov;

--
-- Name: COLUMN client_service_developers.work_schedule; Type: COMMENT; Schema: public; Owner: volodymyrshapovalov
--

COMMENT ON COLUMN public.client_service_developers.work_schedule IS 'Work schedule for developer: {"monday": "full", "tuesday": "full", "wednesday": "half", "thursday": "off", "friday": "full", "saturday": "off", "sunday": "off"}';


--
-- Name: client_service_developers_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.client_service_developers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.client_service_developers_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: client_service_developers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.client_service_developers_id_seq OWNED BY public.client_service_developers.id;


--
-- Name: client_services; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.client_services (
    id integer NOT NULL,
    client_id integer NOT NULL,
    service_type_id integer NOT NULL,
    rate numeric(10,2),
    start_date date NOT NULL,
    end_date date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    service_level_price numeric(10,2)
);


ALTER TABLE public.client_services OWNER TO volodymyrshapovalov;

--
-- Name: client_services_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.client_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.client_services_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: client_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.client_services_id_seq OWNED BY public.client_services.id;


--
-- Name: client_users; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.client_users (
    id integer NOT NULL,
    client_id integer NOT NULL,
    user_id integer NOT NULL,
    access_level character varying(20) DEFAULT 'read'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    assigned_by integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_users OWNER TO volodymyrshapovalov;

--
-- Name: client_users_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.client_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.client_users_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: client_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.client_users_id_seq OWNED BY public.client_users.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    industry text,
    contact_person text,
    email character varying(255),
    phone character varying(20),
    address text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    contract_type character varying(20),
    contract_start date,
    contract_end date,
    billing_rate numeric(10,2),
    billing_cycle character varying(20),
    active_services jsonb,
    team_size integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    logo_url text
);


ALTER TABLE public.clients OWNER TO volodymyrshapovalov;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.clients_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: developer_price_history; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.developer_price_history (
    id integer NOT NULL,
    client_service_developer_id integer NOT NULL,
    hourly_rate numeric(10,2),
    fixed_price numeric(10,2),
    effective_date date NOT NULL,
    end_date date,
    notes text,
    created_by integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.developer_price_history OWNER TO volodymyrshapovalov;

--
-- Name: developer_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.developer_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.developer_price_history_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: developer_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.developer_price_history_id_seq OWNED BY public.developer_price_history.id;


--
-- Name: developers; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.developers (
    id integer NOT NULL,
    name text NOT NULL,
    email character varying(255) NOT NULL,
    skills jsonb,
    hourly_rate numeric(10,2),
    experience_level character varying(20),
    status character varying(20) DEFAULT 'available'::character varying NOT NULL,
    bio text,
    location text,
    avatar_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.developers OWNER TO volodymyrshapovalov;

--
-- Name: developers_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.developers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.developers_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: developers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.developers_id_seq OWNED BY public.developers.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    name text NOT NULL,
    type character varying(50) NOT NULL,
    file_size integer,
    url text NOT NULL,
    user_id integer,
    client_id integer,
    last_updated timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documents OWNER TO volodymyrshapovalov;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.documents_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: employment_cycles; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.employment_cycles (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    cycle_start date NOT NULL,
    cycle_end date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    cycle_midpoint date NOT NULL
);


ALTER TABLE public.employment_cycles OWNER TO volodymyrshapovalov;

--
-- Name: employment_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.employment_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.employment_cycles_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: employment_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.employment_cycles_id_seq OWNED BY public.employment_cycles.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    client_id integer,
    team_member_id integer,
    rating integer,
    comments text,
    feedback_type character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feedback OWNER TO volodymyrshapovalov;

--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.feedback_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- Name: financial_data; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.financial_data (
    id integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    type character varying(50) NOT NULL,
    category text,
    user_id integer,
    client_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.financial_data OWNER TO volodymyrshapovalov;

--
-- Name: financial_data_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.financial_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.financial_data_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: financial_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.financial_data_id_seq OWNED BY public.financial_data.id;


--
-- Name: invoice_developers; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.invoice_developers (
    id integer NOT NULL,
    invoice_service_id integer NOT NULL,
    client_service_developer_id integer NOT NULL,
    hourly_rate numeric(10,2),
    fixed_price numeric(10,2),
    hours_worked numeric(8,2),
    calculated_amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_developers OWNER TO volodymyrshapovalov;

--
-- Name: invoice_developers_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.invoice_developers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoice_developers_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: invoice_developers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.invoice_developers_id_seq OWNED BY public.invoice_developers.id;


--
-- Name: invoice_services; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.invoice_services (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    client_service_id integer NOT NULL,
    service_level_price numeric(10,2),
    calculated_amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_services OWNER TO volodymyrshapovalov;

--
-- Name: invoice_services_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.invoice_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoice_services_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: invoice_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.invoice_services_id_seq OWNED BY public.invoice_services.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    client_id integer NOT NULL,
    invoice_number character varying(50) NOT NULL,
    amount numeric(12,2) NOT NULL,
    invoice_date date NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    description text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    due_date date,
    paid_at timestamp without time zone,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO volodymyrshapovalov;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoices_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: leave_allocation_settings; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.leave_allocation_settings (
    id integer NOT NULL,
    cycle_number integer NOT NULL,
    leave_type_id integer NOT NULL,
    allocated_days numeric(5,1) NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_allocation_settings OWNER TO volodymyrshapovalov;

--
-- Name: leave_allocation_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.leave_allocation_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_allocation_settings_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: leave_allocation_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.leave_allocation_settings_id_seq OWNED BY public.leave_allocation_settings.id;


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    employment_cycle_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    total_days numeric(5,1) DEFAULT '0'::numeric NOT NULL,
    adjustment_days numeric(5,1) DEFAULT '0'::numeric,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_balances OWNER TO volodymyrshapovalov;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_balances_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;


--
-- Name: leave_request_events; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.leave_request_events (
    id integer NOT NULL,
    leave_request_id integer NOT NULL,
    status character varying(20) NOT NULL,
    actor_id integer NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_request_events OWNER TO volodymyrshapovalov;

--
-- Name: leave_request_events_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.leave_request_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_request_events_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: leave_request_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.leave_request_events_id_seq OWNED BY public.leave_request_events.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    half_day_start boolean DEFAULT false,
    half_day_end boolean DEFAULT false,
    days_count numeric(5,1) NOT NULL,
    reason text,
    requested_by integer NOT NULL,
    decision_by integer,
    decision_at timestamp without time zone,
    decision_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_requests OWNER TO volodymyrshapovalov;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_requests_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.leave_types (
    id integer NOT NULL,
    name text NOT NULL,
    is_deductible boolean DEFAULT true,
    half_day_supported boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_types OWNER TO volodymyrshapovalov;

--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_types_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    content text NOT NULL,
    sender_id integer NOT NULL,
    receiver_id integer NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO volodymyrshapovalov;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.messages_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: reimbursement_requests; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.reimbursement_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    year integer NOT NULL,
    expense_amount numeric(10,2) NOT NULL,
    reimbursement_amount numeric(10,2) NOT NULL,
    description text NOT NULL,
    category character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_by integer NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_by integer,
    approved_at timestamp without time zone,
    approval_note text,
    evidence_url text,
    confirmed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reimbursement_requests OWNER TO volodymyrshapovalov;

--
-- Name: reimbursement_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.reimbursement_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reimbursement_requests_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: reimbursement_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.reimbursement_requests_id_seq OWNED BY public.reimbursement_requests.id;


--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.service_requests (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    request_date timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer NOT NULL,
    response_date timestamp without time zone,
    response_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_requests OWNER TO volodymyrshapovalov;

--
-- Name: service_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.service_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.service_requests_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: service_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.service_requests_id_seq OWNED BY public.service_requests.id;


--
-- Name: service_types; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.service_types (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    category character varying(20) NOT NULL,
    billing_model character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_types OWNER TO volodymyrshapovalov;

--
-- Name: service_types_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.service_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.service_types_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: service_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.service_types_id_seq OWNED BY public.service_types.id;


--
-- Name: shift_breaks; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.shift_breaks (
    id integer NOT NULL,
    shift_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    break_type character varying(20) DEFAULT 'regular'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shift_breaks OWNER TO volodymyrshapovalov;

--
-- Name: shift_breaks_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.shift_breaks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shift_breaks_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: shift_breaks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.shift_breaks_id_seq OWNED BY public.shift_breaks.id;


--
-- Name: shift_schedules; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.shift_schedules (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    day_of_week integer NOT NULL,
    start_time character varying(5) NOT NULL,
    end_time character varying(5) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shift_schedules OWNER TO volodymyrshapovalov;

--
-- Name: shift_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.shift_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shift_schedules_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: shift_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.shift_schedules_id_seq OWNED BY public.shift_schedules.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    schedule_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    is_late boolean DEFAULT false,
    late_minutes integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shifts OWNER TO volodymyrshapovalov;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shifts_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    skills jsonb,
    bio text,
    hourly_rate numeric(10,2),
    monthly_rate numeric(10,2),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    client_id integer,
    start_date date NOT NULL,
    location text,
    avatar_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_billable boolean DEFAULT true NOT NULL
);


ALTER TABLE public.team_members OWNER TO volodymyrshapovalov;

--
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.team_members_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.time_entries (
    id integer NOT NULL,
    task_name text NOT NULL,
    hours numeric(5,2) NOT NULL,
    date date NOT NULL,
    user_id integer NOT NULL,
    team_member_id integer,
    billable boolean DEFAULT true,
    approved boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.time_entries OWNER TO volodymyrshapovalov;

--
-- Name: time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_entries_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.time_entries_id_seq OWNED BY public.time_entries.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.user_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO volodymyrshapovalov;

--
-- Name: users; Type: TABLE; Schema: public; Owner: volodymyrshapovalov
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password text NOT NULL,
    full_name text NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'client'::character varying NOT NULL,
    "position" text,
    avatar_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true,
    last_login_at timestamp without time zone,
    team_member_id integer
);


ALTER TABLE public.users OWNER TO volodymyrshapovalov;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: volodymyrshapovalov
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO volodymyrshapovalov;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: volodymyrshapovalov
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: client_contacts id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_contacts ALTER COLUMN id SET DEFAULT nextval('public.client_contacts_id_seq'::regclass);


--
-- Name: client_service_developers id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_service_developers ALTER COLUMN id SET DEFAULT nextval('public.client_service_developers_id_seq'::regclass);


--
-- Name: client_services id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_services ALTER COLUMN id SET DEFAULT nextval('public.client_services_id_seq'::regclass);


--
-- Name: client_users id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_users ALTER COLUMN id SET DEFAULT nextval('public.client_users_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: developer_price_history id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developer_price_history ALTER COLUMN id SET DEFAULT nextval('public.developer_price_history_id_seq'::regclass);


--
-- Name: developers id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developers ALTER COLUMN id SET DEFAULT nextval('public.developers_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: employment_cycles id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.employment_cycles ALTER COLUMN id SET DEFAULT nextval('public.employment_cycles_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: financial_data id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.financial_data ALTER COLUMN id SET DEFAULT nextval('public.financial_data_id_seq'::regclass);


--
-- Name: invoice_developers id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_developers ALTER COLUMN id SET DEFAULT nextval('public.invoice_developers_id_seq'::regclass);


--
-- Name: invoice_services id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_services ALTER COLUMN id SET DEFAULT nextval('public.invoice_services_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: leave_allocation_settings id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_allocation_settings ALTER COLUMN id SET DEFAULT nextval('public.leave_allocation_settings_id_seq'::regclass);


--
-- Name: leave_balances id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);


--
-- Name: leave_request_events id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_request_events ALTER COLUMN id SET DEFAULT nextval('public.leave_request_events_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: reimbursement_requests id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.reimbursement_requests ALTER COLUMN id SET DEFAULT nextval('public.reimbursement_requests_id_seq'::regclass);


--
-- Name: service_requests id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.service_requests ALTER COLUMN id SET DEFAULT nextval('public.service_requests_id_seq'::regclass);


--
-- Name: service_types id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.service_types ALTER COLUMN id SET DEFAULT nextval('public.service_types_id_seq'::regclass);


--
-- Name: shift_breaks id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_breaks ALTER COLUMN id SET DEFAULT nextval('public.shift_breaks_id_seq'::regclass);


--
-- Name: shift_schedules id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_schedules ALTER COLUMN id SET DEFAULT nextval('public.shift_schedules_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- Name: time_entries id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.time_entries ALTER COLUMN id SET DEFAULT nextval('public.time_entries_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: client_contacts client_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);


--
-- Name: client_service_developers client_service_developers_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_service_developers
    ADD CONSTRAINT client_service_developers_pkey PRIMARY KEY (id);


--
-- Name: client_services client_services_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_services
    ADD CONSTRAINT client_services_pkey PRIMARY KEY (id);


--
-- Name: client_users client_users_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: developer_price_history developer_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developer_price_history
    ADD CONSTRAINT developer_price_history_pkey PRIMARY KEY (id);


--
-- Name: developers developers_email_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developers
    ADD CONSTRAINT developers_email_unique UNIQUE (email);


--
-- Name: developers developers_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developers
    ADD CONSTRAINT developers_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: employment_cycles employment_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.employment_cycles
    ADD CONSTRAINT employment_cycles_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: financial_data financial_data_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.financial_data
    ADD CONSTRAINT financial_data_pkey PRIMARY KEY (id);


--
-- Name: invoice_developers invoice_developers_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_developers
    ADD CONSTRAINT invoice_developers_pkey PRIMARY KEY (id);


--
-- Name: invoice_services invoice_services_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_services
    ADD CONSTRAINT invoice_services_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leave_allocation_settings leave_allocation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_allocation_settings
    ADD CONSTRAINT leave_allocation_settings_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_request_events leave_request_events_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_request_events
    ADD CONSTRAINT leave_request_events_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_unique UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: reimbursement_requests reimbursement_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.reimbursement_requests
    ADD CONSTRAINT reimbursement_requests_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_types service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);


--
-- Name: user_sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: shift_breaks shift_breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_breaks
    ADD CONSTRAINT shift_breaks_pkey PRIMARY KEY (id);


--
-- Name: shift_schedules shift_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_email_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_email_unique UNIQUE (email);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: client_users_client_id_user_id_unique; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE UNIQUE INDEX client_users_client_id_user_id_unique ON public.client_users USING btree (client_id, user_id);


--
-- Name: idx_users_team_member_id; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX idx_users_team_member_id ON public.users USING btree (team_member_id);


--
-- Name: shift_breaks_shift_id_idx; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX shift_breaks_shift_id_idx ON public.shift_breaks USING btree (shift_id);


--
-- Name: shift_schedules_employee_id_idx; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX shift_schedules_employee_id_idx ON public.shift_schedules USING btree (employee_id);


--
-- Name: shifts_employee_id_idx; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX shifts_employee_id_idx ON public.shifts USING btree (employee_id);


--
-- Name: shifts_start_time_idx; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX shifts_start_time_idx ON public.shifts USING btree (start_time);


--
-- Name: shifts_status_idx; Type: INDEX; Schema: public; Owner: volodymyrshapovalov
--

CREATE INDEX shifts_status_idx ON public.shifts USING btree (status);


--
-- Name: client_contacts client_contacts_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: client_service_developers client_service_developers_client_service_id_client_services_id_; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_service_developers
    ADD CONSTRAINT client_service_developers_client_service_id_client_services_id_ FOREIGN KEY (client_service_id) REFERENCES public.client_services(id);


--
-- Name: client_service_developers client_service_developers_developer_id_developers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_service_developers
    ADD CONSTRAINT client_service_developers_developer_id_developers_id_fk FOREIGN KEY (developer_id) REFERENCES public.developers(id);


--
-- Name: client_services client_services_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_services
    ADD CONSTRAINT client_services_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: client_services client_services_service_type_id_service_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_services
    ADD CONSTRAINT client_services_service_type_id_service_types_id_fk FOREIGN KEY (service_type_id) REFERENCES public.service_types(id);


--
-- Name: client_users client_users_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: client_users client_users_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: client_users client_users_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: developer_price_history developer_price_history_client_service_developer_id_client_serv; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developer_price_history
    ADD CONSTRAINT developer_price_history_client_service_developer_id_client_serv FOREIGN KEY (client_service_developer_id) REFERENCES public.client_service_developers(id);


--
-- Name: developer_price_history developer_price_history_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.developer_price_history
    ADD CONSTRAINT developer_price_history_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: documents documents_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: documents documents_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: employment_cycles employment_cycles_employee_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.employment_cycles
    ADD CONSTRAINT employment_cycles_employee_id_team_members_id_fk FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: feedback feedback_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: feedback feedback_team_member_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_team_member_id_team_members_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id);


--
-- Name: feedback feedback_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: financial_data financial_data_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.financial_data
    ADD CONSTRAINT financial_data_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: financial_data financial_data_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.financial_data
    ADD CONSTRAINT financial_data_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: invoice_developers invoice_developers_client_service_developer_id_client_service_d; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_developers
    ADD CONSTRAINT invoice_developers_client_service_developer_id_client_service_d FOREIGN KEY (client_service_developer_id) REFERENCES public.client_service_developers(id);


--
-- Name: invoice_developers invoice_developers_invoice_service_id_invoice_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_developers
    ADD CONSTRAINT invoice_developers_invoice_service_id_invoice_services_id_fk FOREIGN KEY (invoice_service_id) REFERENCES public.invoice_services(id);


--
-- Name: invoice_services invoice_services_client_service_id_client_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_services
    ADD CONSTRAINT invoice_services_client_service_id_client_services_id_fk FOREIGN KEY (client_service_id) REFERENCES public.client_services(id);


--
-- Name: invoice_services invoice_services_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoice_services
    ADD CONSTRAINT invoice_services_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoices invoices_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: invoices invoices_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: leave_allocation_settings leave_allocation_settings_leave_type_id_leave_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_allocation_settings
    ADD CONSTRAINT leave_allocation_settings_leave_type_id_leave_types_id_fk FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_balances leave_balances_employee_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_team_members_id_fk FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: leave_balances leave_balances_employment_cycle_id_employment_cycles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employment_cycle_id_employment_cycles_id_fk FOREIGN KEY (employment_cycle_id) REFERENCES public.employment_cycles(id);


--
-- Name: leave_balances leave_balances_leave_type_id_leave_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_leave_types_id_fk FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_request_events leave_request_events_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_request_events
    ADD CONSTRAINT leave_request_events_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: leave_request_events leave_request_events_leave_request_id_leave_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_request_events
    ADD CONSTRAINT leave_request_events_leave_request_id_leave_requests_id_fk FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id);


--
-- Name: leave_requests leave_requests_decision_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_decision_by_users_id_fk FOREIGN KEY (decision_by) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_employee_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_team_members_id_fk FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: leave_requests leave_requests_leave_type_id_leave_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_leave_types_id_fk FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_requests leave_requests_requested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: messages messages_receiver_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: reimbursement_requests reimbursement_requests_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.reimbursement_requests
    ADD CONSTRAINT reimbursement_requests_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: reimbursement_requests reimbursement_requests_employee_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.reimbursement_requests
    ADD CONSTRAINT reimbursement_requests_employee_id_team_members_id_fk FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: reimbursement_requests reimbursement_requests_requested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.reimbursement_requests
    ADD CONSTRAINT reimbursement_requests_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: service_requests service_requests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: shift_breaks shift_breaks_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_breaks
    ADD CONSTRAINT shift_breaks_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: shift_schedules shift_schedules_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: shifts shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.team_members(id);


--
-- Name: shifts shifts_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.shift_schedules(id);


--
-- Name: team_members team_members_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: time_entries time_entries_team_member_id_team_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_team_member_id_team_members_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id);


--
-- Name: time_entries time_entries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: volodymyrshapovalov
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dTL13PCXqovPaDnhM5Pm8arVA8eZebrSdvS9dvzdSwE8shOPKJIvd8ayGtTXwjW

