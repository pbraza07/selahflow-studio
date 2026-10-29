-- Apply the requested temporary password only to accounts still awaiting first setup.
DELETE FROM team_sessions WHERE account_id IN (SELECT id FROM team_accounts WHERE must_change_password=true);
UPDATE team_accounts SET password_hash='scrypt:354e83e0a03225d3abc6ba1aea0be62a:2b9007790a528350953e13aa12a5667af82696d43e02d2a1518a61dcc68766fd0772b706af2528189208af2375c140686a100d894ec720f18b46de2564bff087' WHERE must_change_password=true;
