--
-- PostgreSQL database dump
--

\restrict UteG4kPMInQanZKr5M80Ew8u6F9fm2e0dJthlXRotGkbp5bkkhKwGwXWXU5dfsb

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
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: volodymyrshapovalov
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: client_contacts; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.client_contacts (id, client_id, full_name, "position", email, phone, notes, is_primary, is_active, created_at, updated_at) FROM stdin;
1	1	Kamran	CEO	efsefse@fdgddrgd.vom	324324234234	\N	t	t	2025-09-16 19:05:45.714041	2025-09-16 19:05:45.714041
\.


--
-- Data for Name: client_service_developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.client_service_developers (id, client_service_id, developer_id, employment_type, hourly_rate, fixed_price, is_active, start_date, end_date, created_at, work_schedule) FROM stdin;
5	5	5	fulltime	\N	4000.00	t	2025-09-07	\N	2025-09-07 10:27:48.233834	\N
3	5	4	fulltime	\N	5300.00	t	2025-09-07	\N	2025-09-07 09:38:40.652154	\N
4	5	6	part_time	\N	2000.00	t	2025-09-07	\N	2025-09-07 09:39:30.978032	{"friday": "half", "monday": "off", "sunday": "off", "tuesday": "full", "saturday": "off", "thursday": "full", "wednesday": "off"}
7	8	6	part_time	\N	\N	t	2025-11-02	\N	2025-11-02 20:23:18.029051	{"friday": "half", "monday": "full", "sunday": "off", "tuesday": "off", "saturday": "off", "thursday": "off", "wednesday": "full"}
\.


--
-- Data for Name: client_services; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.client_services (id, client_id, service_type_id, rate, start_date, end_date, is_active, created_at, service_level_price) FROM stdin;
5	1	16	\N	2025-09-07	\N	t	2025-09-07 08:49:35.655402	\N
8	4	17	\N	2025-09-21	\N	t	2025-11-02 20:22:56.696353	4000.00
\.


--
-- Data for Name: client_users; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.client_users (id, client_id, user_id, access_level, is_active, assigned_by, assigned_at, created_at, updated_at) FROM stdin;
1	1	2	write	t	1	2025-09-16 23:52:27.723015	2025-09-16 23:52:27.723015	2025-09-16 20:52:49.84
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.clients (id, name, industry, contact_person, email, phone, address, status, contract_type, contract_start, contract_end, billing_rate, billing_cycle, active_services, team_size, created_at, updated_at, logo_url) FROM stdin;
1	Chronogrid	Technology	John Smith	john.smith@techcorp.com	+1-555-0123	123 Tech Street, Silicon Valley, CA	active	outstaffing	2024-01-01	2024-12-31	150.00	monthly	["Software Development", "UI/UX Design"]	5	2025-09-06 10:46:41.348479	2025-10-28 10:53:01.97	/uploads/logos/logo-1761648781961-274765820.jpg
4	Marrew Tech	\N	Jack	\N	\N	\N	active	\N	2025-09-21	\N	\N	monthly	\N	0	2025-11-02 20:19:08.7933	2025-11-02 20:19:08.7933	\N
\.


--
-- Data for Name: developer_price_history; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.developer_price_history (id, client_service_developer_id, hourly_rate, fixed_price, effective_date, end_date, notes, created_by, is_active, created_at) FROM stdin;
2	3	\N	5300.00	2025-09-07	2025-09-07	\N	1	f	2025-09-07 10:20:56.264766
5	3	\N	5300.00	2025-09-07	\N	\N	1	t	2025-09-07 10:43:25.335407
3	4	\N	2000.00	2025-09-07	2025-09-08	\N	1	f	2025-09-07 10:28:17.561962
6	4	\N	2000.00	2025-09-08	\N	Moday, Tuesday + half Friday	1	t	2025-09-08 16:09:21.482533
\.


--
-- Data for Name: developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.developers (id, name, email, skills, hourly_rate, experience_level, status, bio, location, avatar_url, created_at, updated_at) FROM stdin;
4	Sergei Vasilenko	s.vasilenko@vestov.com	["React", "TypeScript", "Node.js", "PostgreSQL"]	45.00	senior	available	Full-stack developer with 5+ years experience in modern web technologies	Ukraine	https://ca.slack-edge.com/T072FNCP2PR-U0732PAN6HH-gf83efc5d2fb-512	2025-09-07 08:45:06.61991	2025-09-07 07:15:49.246
5	Eduardo Cerato	eduardo.cerato@vestov.com	["Vue.js", "Python", "Django", "MongoDB"]	40.00	middle	available	Full-stack developer specializing in Vue.js and Python backends	Brazil	https://ca.slack-edge.com/T072FNCP2PR-U080JFM4L7J-3fa90a1830be-512	2025-09-07 08:45:06.61991	2025-09-07 07:16:26.138
6	Jéssica Ferreira	j.ferreira@vestov.com	["Angular", "Java", "Spring Boot", "MySQL"]	50.00	middle	available	Enterprise application developer with expertise in Angular and Java ecosystem	Brazil	https://ca.slack-edge.com/T072FNCP2PR-U099JMRR9GD-88d31b853181-512	2025-09-07 08:45:06.61991	2025-09-09 07:53:04.91
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.documents (id, name, type, file_size, url, user_id, client_id, last_updated, created_at) FROM stdin;
1	Enrollment-Volodymyr-Shapovalov (1).pdf	contract	47840	/uploads/documents/document-1758032674126-793880572.pdf	1	1	2025-09-16 17:24:34.143238	2025-09-16 17:24:34.143238
3	all_patients_boldRx.xlsx	general	936803	/uploads/documents/document-1758033432895-133348700.xlsx	1	1	2025-09-16 17:37:12.910197	2025-09-16 17:37:12.910197
\.


--
-- Data for Name: employment_cycles; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.employment_cycles (id, employee_id, cycle_start, cycle_end, is_active, created_at, cycle_midpoint) FROM stdin;
6	10	2025-09-11	2026-09-11	f	2025-09-16 14:50:01.26055	2026-03-11
7	10	2020-09-01	2021-09-01	f	2020-09-01 00:00:00	2021-03-01
8	10	2021-09-01	2022-09-01	f	2021-09-01 00:00:00	2022-03-01
9	10	2022-09-01	2023-09-01	f	2022-09-01 00:00:00	2023-03-01
10	10	2023-09-01	2024-09-01	f	2023-09-01 00:00:00	2024-03-01
5	11	2024-11-18	2025-11-18	t	2025-09-16 12:59:31.110214	2025-05-18
17	12	2025-09-01	2026-08-31	t	2025-10-24 20:44:57.174867	2026-03-01
11	10	2025-01-21	2026-01-20	t	2024-09-01 00:00:00	2025-07-20
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.feedback (id, user_id, client_id, team_member_id, rating, comments, feedback_type, status, created_at) FROM stdin;
\.


--
-- Data for Name: financial_data; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.financial_data (id, month, year, amount, type, category, user_id, client_id, created_at) FROM stdin;
\.


--
-- Data for Name: invoice_developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.invoice_developers (id, invoice_service_id, client_service_developer_id, hourly_rate, fixed_price, hours_worked, calculated_amount, created_at) FROM stdin;
\.


--
-- Data for Name: invoice_services; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.invoice_services (id, invoice_id, client_service_id, service_level_price, calculated_amount, created_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.invoices (id, client_id, invoice_number, amount, invoice_date, period_start, period_end, description, status, due_date, paid_at, notes, created_by, created_at, updated_at) FROM stdin;
5	1	INV-2025-0003	1330.00	2024-10-03	2024-09-01	2024-09-30		paid	\N	2024-10-03 12:00:00		1	2025-09-09 15:43:02.950113	2025-09-09 12:44:17.47
6	1	INV-2025-0004	2625.00	2024-11-05	2024-10-01	2024-10-31		paid	\N	2024-11-05 12:00:00	Development	1	2025-09-09 15:46:16.687167	2025-09-09 12:46:31.608
7	1	INV-2025-0005	6390.00	2024-12-02	2024-11-01	2024-11-30	Development	paid	\N	2024-12-02 12:00:00		1	2025-09-09 16:33:30.672604	2025-09-09 13:33:42.961
8	1	INV-2025-0006	5625.00	2025-01-08	2024-12-01	2024-12-31		paid	\N	2025-01-08 12:00:00		1	2025-09-09 16:34:58.534186	2025-09-09 13:35:09.527
10	1	INV-2025-0008	7011.00	2025-03-01	2025-02-01	2025-02-28	\N	paid	\N	2025-03-01 00:00:00	\N	1	2025-10-29 02:05:17.757213	2025-10-29 02:05:17.757213
11	1	INV-2025-0009	8612.00	2025-04-01	2025-03-01	2025-03-31	\N	paid	\N	2025-04-01 00:00:00	\N	1	2025-10-29 02:06:09.680845	2025-10-29 02:06:09.680845
12	1	INV-2025-0010	7597.00	2025-05-01	2025-04-01	2025-04-30	\N	paid	\N	2025-05-01 00:00:00	\N	1	2025-10-29 02:07:43.657837	2025-10-29 02:07:43.657837
13	1	INV-2025-0011	10412.00	2025-06-01	2025-05-01	2025-05-31	\N	paid	\N	2025-06-01 00:00:00	\N	1	2025-10-29 02:10:35.607356	2025-10-29 02:10:35.607356
14	1	INV-2025-0012	9155.00	2025-07-01	2025-06-01	2025-06-30	\N	paid	\N	2025-07-01 00:00:00	\N	1	2025-10-29 02:12:33.392846	2025-10-29 02:12:33.392846
15	1	INV-2025-0013	12075.00	2025-08-01	2025-07-01	2025-07-31	\N	paid	\N	2025-08-01 00:00:00	\N	1	2025-10-29 02:16:00.695128	2025-10-29 02:16:00.695128
16	1	INV-2025-0014	9300.00	2025-09-01	2025-08-01	2025-08-31	\N	paid	\N	2025-09-01 00:00:00	\N	1	2025-10-29 02:16:44.758419	2025-10-29 02:16:44.758419
17	1	INV-2025-0015	11300.00	2025-10-03	2025-09-01	2025-09-30	\N	paid	\N	2025-10-03 00:00:00	\N	1	2025-10-29 02:17:16.767041	2025-10-29 02:17:16.767041
9	1	INV-2025-0007	8270.00	2025-02-06	2025-01-01	2025-01-31	\N	paid	\N	2025-02-10 00:00:00	\N	1	2025-10-29 02:01:52.793459	2025-10-29 00:21:30.018
32	1	INV-2025-0016	11300.00	2025-11-02	2025-10-31	2025-11-29	\N	paid	\N	2025-11-02 00:00:00	\N	1	2025-11-02 19:41:27.029407	2025-11-02 19:41:27.029407
33	4	INV-2025-0017	1500.00	2025-10-03	2025-10-31	2025-11-29	\N	paid	\N	2025-10-03 00:00:00	\N	1	2025-11-03 11:38:28.598901	2025-11-03 11:38:28.598901
34	4	INV-2025-0018	1500.00	2025-11-01	2025-10-31	2025-11-29	\N	paid	\N	2025-11-01 00:00:00	\N	1	2025-11-03 11:39:45.360976	2025-11-03 11:39:45.360976
35	4	INV-2025-0019	1000.00	2025-11-04	2025-10-31	2025-11-29	\N	paid	\N	2025-11-04 00:00:00	\N	1	2025-11-04 11:57:04.477996	2025-11-04 11:57:04.477996
\.


--
-- Data for Name: leave_allocation_settings; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.leave_allocation_settings (id, cycle_number, leave_type_id, allocated_days, is_default, created_at, updated_at) FROM stdin;
1	1	1	15.0	f	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
3	2	1	20.0	f	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
5	3	1	25.0	t	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
2	1	2	7.0	f	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
4	2	2	7.0	f	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
6	3	2	7.0	t	2025-09-16 13:22:03.611735	2025-09-16 13:22:03.611735
\.


--
-- Data for Name: leave_balances; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.leave_balances (id, employee_id, employment_cycle_id, leave_type_id, total_days, adjustment_days, created_at, updated_at) FROM stdin;
23	10	6	1	30.0	0.0	2025-09-16 14:50:01.272134	2025-09-16 14:50:01.272134
24	10	6	2	10.0	0.0	2025-09-16 14:50:01.273395	2025-09-16 14:50:01.273395
52	12	17	3	15.0	0.0	2025-10-24 20:44:57.176907	2025-10-24 20:44:57.176907
53	12	17	4	15.0	0.0	2025-10-24 20:44:57.177398	2025-10-24 20:44:57.177398
54	12	17	5	15.0	0.0	2025-10-24 20:44:57.177926	2025-10-24 20:44:57.177926
21	11	5	1	15.0	0.0	2025-09-16 12:59:31.124566	2025-09-16 12:59:31.124566
22	11	5	2	7.0	0.0	2025-09-16 12:59:31.130598	2025-09-16 12:59:31.130598
50	12	17	1	15.0	0.0	2025-10-24 20:44:57.175914	2025-10-24 20:44:57.175914
51	12	17	2	7.0	0.0	2025-10-24 20:44:57.176433	2025-10-24 20:44:57.176433
\.


--
-- Data for Name: leave_request_events; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.leave_request_events (id, leave_request_id, status, actor_id, note, created_at) FROM stdin;
39	18	approved	1	Auto-approved by admin from calendar	2025-10-30 00:21:08.313774
40	19	approved	1	Auto-approved by admin from calendar	2025-10-30 00:21:27.671753
41	20	approved	1	Auto-approved by admin from calendar	2025-10-30 00:21:35.782584
42	21	approved	1	Auto-approved by admin from calendar	2025-10-30 00:22:05.373505
43	22	approved	1	Auto-approved by admin from calendar	2025-10-30 00:22:41.492377
44	23	approved	1	Auto-approved by admin from calendar	2025-10-30 00:31:05.500735
45	24	approved	1	Auto-approved by admin from calendar	2025-10-30 00:31:22.3168
46	22	approved	1	Request details updated by admin	2025-10-30 12:57:51.950016
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.leave_requests (id, employee_id, leave_type_id, status, start_date, end_date, half_day_start, half_day_end, days_count, reason, requested_by, decision_by, decision_at, decision_reason, created_at, updated_at) FROM stdin;
18	11	1	approved	2025-10-31	2025-10-31	f	f	1.0	\N	1	1	2025-10-29 22:21:08.305	Auto-approved by admin from calendar	2025-10-30 00:21:08.307001	2025-10-30 00:21:08.307001
19	11	1	approved	2025-11-06	2025-11-06	f	f	1.0	\N	1	1	2025-10-29 22:21:27.666	Auto-approved by admin from calendar	2025-10-30 00:21:27.667842	2025-10-30 00:21:27.667842
20	11	1	approved	2025-11-07	2025-11-07	f	f	1.0	\N	1	1	2025-10-29 22:21:35.78	Auto-approved by admin from calendar	2025-10-30 00:21:35.781091	2025-10-30 00:21:35.781091
21	11	1	approved	2025-11-14	2025-11-14	f	f	1.0	\N	1	1	2025-10-29 22:22:05.367	Auto-approved by admin from calendar	2025-10-30 00:22:05.367809	2025-10-30 00:22:05.367809
23	10	1	approved	2025-11-03	2025-11-07	f	f	5.0	\N	1	1	2025-10-29 22:31:05.495	Auto-approved by admin from calendar	2025-10-30 00:31:05.496224	2025-10-30 00:31:05.496224
24	10	1	approved	2025-11-10	2025-11-14	f	f	5.0	\N	1	1	2025-10-29 22:31:22.309	Auto-approved by admin from calendar	2025-10-30 00:31:22.311103	2025-10-30 00:31:22.311103
22	11	1	approved	2025-11-17	2025-11-17	f	f	1.0	\N	1	1	2025-10-29 22:22:41.487	Auto-approved by admin from calendar	2025-10-30 00:22:41.487427	2025-10-30 00:22:41.487427
\.


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.leave_types (id, name, is_deductible, half_day_supported, created_at) FROM stdin;
1	Vacation	t	t	2025-09-06 10:46:41.339005
2	Sick Leave	t	t	2025-09-06 10:46:41.339005
3	Personal Leave	t	t	2025-09-06 10:46:41.339005
4	Maternity Leave	f	f	2025-09-06 10:46:41.339005
5	Emergency Leave	t	t	2025-09-06 10:46:41.339005
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.messages (id, content, sender_id, receiver_id, read, created_at) FROM stdin;
\.


--
-- Data for Name: reimbursement_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.reimbursement_requests (id, employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, approved_by, approved_at, approval_note, evidence_url, confirmed_at, created_at, updated_at) FROM stdin;
1	11	2025	278.00	139.00	erserse esser	chair	confirmed	7	2025-10-25 11:45:23.08002	1	2025-10-25 08:46:21.546	rw3ew3er	/uploads/evidence-1761653613036-59254472.jpg	2025-10-28 12:13:33.073	2025-10-25 11:45:23.08002	2025-10-28 12:13:33.073
\.


--
-- Data for Name: service_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.service_requests (id, title, description, status, request_date, user_id, response_date, response_message, created_at) FROM stdin;
\.


--
-- Data for Name: service_types; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.service_types (id, name, description, category, billing_model, created_at, updated_at) FROM stdin;
15	Outstaffing	Dedicated developers working on your project remotely as an extension of your team	outstaffing	monthly	2025-09-07 08:45:06.614365	2025-09-07 08:45:06.614365
16	Outsourcing	Complete project development handled by our team with full project management	outsourcing	fixed	2025-09-07 08:45:06.614365	2025-09-07 08:45:06.614365
17	Pay Per Delivery (PPD)	Pay only for completed deliverables and milestones	outsourcing	fixed	2025-09-07 08:45:06.614365	2025-09-07 08:45:06.614365
\.


--
-- Data for Name: shift_breaks; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.shift_breaks (id, shift_id, start_time, end_time, break_type, notes, created_at) FROM stdin;
1	1	2025-10-29 17:07:45.236	2025-10-29 17:07:50.312	regular	\N	2025-10-29 19:07:45.237395
2	2	2025-10-29 17:08:16.226	2025-10-29 17:08:18.64	regular	\N	2025-10-29 19:08:16.226564
3	3	2025-10-29 17:08:54.297	2025-10-29 17:09:12.74	regular	\N	2025-10-29 19:08:54.299182
4	5	2025-10-29 17:09:32.386	2025-10-29 18:03:39.459	regular	\N	2025-10-29 19:09:32.387013
5	6	2025-10-29 18:04:19.119	2025-10-29 22:50:38.413	regular	\N	2025-10-29 20:04:19.119659
6	9	2025-10-31 21:38:47.792	2025-10-31 21:38:50.412	regular	\N	2025-10-31 23:38:47.793068
\.


--
-- Data for Name: shift_schedules; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.shift_schedules (id, employee_id, day_of_week, start_time, end_time, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.shifts (id, employee_id, schedule_id, start_time, end_time, status, is_late, late_minutes, notes, created_at, updated_at) FROM stdin;
1	12	\N	2025-10-29 17:07:32.248	2025-10-29 17:07:54.408	completed	f	0	\N	2025-10-29 19:07:32.251758	2025-10-29 17:07:54.408
2	12	\N	2025-10-29 17:07:56.074	2025-10-29 17:08:18.641	completed	f	0	\N	2025-10-29 19:07:56.076986	2025-10-29 17:08:18.641
3	12	\N	2025-10-29 17:08:38.071	2025-10-29 17:09:12.742	completed	f	0	\N	2025-10-29 19:08:38.072533	2025-10-29 17:09:12.742
5	10	\N	2025-10-29 17:09:31.493	2025-10-29 18:03:39.463	completed	f	0	\N	2025-10-29 19:09:31.49514	2025-10-29 18:03:39.463
6	11	\N	2025-10-29 17:09:38.75	2025-10-29 22:50:38.417	completed	f	0	\N	2025-10-29 19:09:38.752425	2025-10-29 22:50:38.417
7	10	\N	2025-10-29 18:03:42.887	2025-10-29 22:50:50.518	completed	f	0	\N	2025-10-29 20:03:42.895206	2025-10-29 22:50:50.518
4	12	\N	2025-10-29 17:09:23.693	2025-10-29 22:50:58.39	completed	f	0	\N	2025-10-29 19:09:23.695654	2025-10-29 22:50:58.39
8	11	\N	2025-10-30 11:20:59.429	2025-10-31 10:33:55.345	completed	f	0	\N	2025-10-30 13:20:59.435217	2025-10-31 10:33:55.345
9	10	\N	2025-10-31 21:38:41.593	2025-10-31 21:38:54.575	completed	f	0	\N	2025-10-31 23:38:41.596743	2025-10-31 21:38:54.575
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.team_members (id, name, role, email, phone, skills, bio, hourly_rate, monthly_rate, status, client_id, start_date, location, avatar_url, created_at, updated_at, is_billable) FROM stdin;
11	Eduardo Cerato	Full-Stack Developer	eduardo.cerato@vestov.com	\N	["React", "Next.js", "Python", "AWS"]	\N	70.00	\N	active	\N	2024-11-18	São Paulo	https://ca.slack-edge.com/T072FNCP2PR-U080JFM4L7J-3fa90a1830be-512	2025-09-13 20:59:57.892425	2025-10-25 08:15:09.984	t
12	Jéssica Ferreira	Frontend Developer	j.ferreira@vestov.com	\N	["React", "Vue.js", "CSS", "JavaScript"]	\N	60.00	\N	active	\N	2025-09-01	Rio de Janeiro	https://ca.slack-edge.com/T072FNCP2PR-U099JMRR9GD-88d31b853181-512	2025-09-13 20:59:57.892425	2025-10-25 08:15:36.385	t
10	Sergei Vasilenko	Senior Backend Developer	s.vasilenko@vestov.com	\N	["Node.js", "TypeScript", "PostgreSQL", "Docker"]	\N	85.00	\N	active	\N	2021-01-21	Remote	https://ca.slack-edge.com/T072FNCP2PR-U0732PAN6HH-gf83efc5d2fb-512	2025-09-13 20:59:57.892425	2025-10-27 14:12:36.566	t
\.


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.time_entries (id, task_name, hours, date, user_id, team_member_id, billable, approved, created_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.user_sessions (sid, sess, expire) FROM stdin;
S6w7gisffDV09HAI17CQlcPKC_HN5et1	{"cookie":{"originalMaxAge":86400000,"expires":"2025-12-05T11:21:23.502Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":{"id":1}}}	2025-12-05 13:22:26
h3JdJgs1Nr8gXmvxWdOro_4YOu1mEWFR	{"cookie":{"originalMaxAge":86400000,"expires":"2025-12-02T10:37:49.373Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":{"id":1}}}	2025-12-02 15:27:12
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

COPY public.users (id, username, password, full_name, email, role, "position", avatar_url, created_at, updated_at, is_active, last_login_at, team_member_id) FROM stdin;
1	admin	$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m	System Administrator	v@vestov.com	admin	System Administrator	\N	2025-09-06 10:46:41.687777	2025-10-25 08:16:19.951	t	\N	\N
2	kamran	$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2	Kamran	john.smith@techcorp.com	client	CEO	\N	2025-09-06 10:46:41.983743	2025-10-26 19:18:35.763	t	\N	\N
7	eduardo	$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG	Eduardo Cerato	eduardo.cerato@vestov.com	team_member	Full-Stack Developer	\N	2025-10-25 00:56:03.767059	2025-10-25 00:56:03.767059	t	\N	11
8	s.vasilenko	$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6	Sergei Vasilenko	s.vasilenko@vestov.com	team_member		\N	2025-10-27 16:10:35.508461	2025-10-27 16:10:35.508461	t	\N	10
9	j.ferreira	$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O	Jéssica Ferreira	j.ferreira@vestov.com	team_member		\N	2025-10-27 21:12:24.595956	2025-10-27 21:12:24.595956	t	\N	12
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 3, true);


--
-- Name: client_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_contacts_id_seq', 1, true);


--
-- Name: client_service_developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_service_developers_id_seq', 7, true);


--
-- Name: client_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_services_id_seq', 8, true);


--
-- Name: client_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_users_id_seq', 2, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.clients_id_seq', 4, true);


--
-- Name: developer_price_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.developer_price_history_id_seq', 6, true);


--
-- Name: developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.developers_id_seq', 8, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.documents_id_seq', 3, true);


--
-- Name: employment_cycles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.employment_cycles_id_seq', 18, true);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.feedback_id_seq', 1, false);


--
-- Name: financial_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.financial_data_id_seq', 1, false);


--
-- Name: invoice_developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoice_developers_id_seq', 1, false);


--
-- Name: invoice_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoice_services_id_seq', 1, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoices_id_seq', 35, true);


--
-- Name: leave_allocation_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_allocation_settings_id_seq', 6, true);


--
-- Name: leave_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_balances_id_seq', 59, true);


--
-- Name: leave_request_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_request_events_id_seq', 46, true);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 24, true);


--
-- Name: leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_types_id_seq', 15, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: reimbursement_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.reimbursement_requests_id_seq', 1, true);


--
-- Name: service_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.service_requests_id_seq', 1, false);


--
-- Name: service_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.service_types_id_seq', 27, true);


--
-- Name: shift_breaks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shift_breaks_id_seq', 6, true);


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shift_schedules_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shifts_id_seq', 9, true);


--
-- Name: team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.team_members_id_seq', 16, true);


--
-- Name: time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.time_entries_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


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

\unrestrict UteG4kPMInQanZKr5M80Ew8u6F9fm2e0dJthlXRotGkbp5bkkhKwGwXWXU5dfsb

