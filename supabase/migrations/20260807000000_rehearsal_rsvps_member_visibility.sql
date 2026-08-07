-- ============================================================
-- Ritovo — Rehearsal RSVPs readable by the whole group
-- Run in Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- 20260607000000_rehearsal_rsvps.sql let a member SELECT only their OWN rsvp
-- row unless they were a band admin. The UI has always assumed the opposite —
-- rsvpCardHtml() in index.html carries the comment "Attendance is group
-- coordination, not admin data — every member sees who is coming" — and there
-- is no role check anywhere on the client: it simply renders whatever rows the
-- fetch returns. So for a non-admin the "x / y confirmed" chip and the
-- attendance breakdown counted only themselves, and every other member
-- silently collapsed to "Pending".
--
-- Widen the read to any member of the band that owns the rehearsal.
-- is_band_member() (see rls.sql) matches any band_members row regardless of
-- role, so admins, members and guests all read the same list.
--
-- Writes are deliberately NOT touched: insert/update/delete still require
-- user_id = auth.uid(), so a member can still only answer for themselves.

drop policy if exists rehearsal_rsvps_select on rehearsal_rsvps;
create policy rehearsal_rsvps_select on rehearsal_rsvps
  for select using (
    -- your own answer stays readable even if you have since left the band
    user_id = auth.uid()
    or exists(
      select 1 from rehearsals r
      where r.id = rehearsal_rsvps.rehearsal_id and is_band_member(r.band_id)
    )
  );
