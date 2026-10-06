# Sincronização QuarkRH — Departamento Pessoal

Projeto: bkcnolpwteeqgipweiqs. A função exige JWT de usuário aprovado com perfil admin/rh. A gravação ocorre em uma única transação, sem DELETE, por CPF normalizado. IDs e subgrupo_plano_conta_id dos cadastros existentes são preservados.

A credencial pode vir do segredo QUARK_AUTH_TOKEN da Edge Function ou do Supabase Vault, nome QUARK_DEPARTMENT_AUTH_TOKEN. O acesso ao Vault passa por uma função privada e um RPC SECURITY INVOKER, ambos exclusivos do service_role. Nenhuma credencial deve ser inserida no frontend, no repositório ou em migrations.

A lista de empresas é descoberta em /v1/unidades. Só as seis unidades originais estão habilitadas inicialmente. Outras precisam ser incluídas no diálogo de mapeamentos. Equipes são vinculadas por unidade + equipe, evitando colisão de códigos externos.

Situação desconhecida fica nula. Desligamento prevalece sobre o campo ativo do Quark. Cadastros sem mapeamento entram com códigos nulos; quando já existem, os vínculos anteriores são preservados e a pendência fica registrada. CPF com múltiplos vínculos ativos conflitantes é ignorado e contabilizado. Ausência na resposta nunca implica desligamento ou exclusão.

Origem registra a primeira fonte conhecida; ultima_origem_atualizacao registra a última edição. Cadastros anteriores à integração ficam sem origem/situação até uma atualização fornecer esses dados. O Excel existente continua disponível.

Salvar mapeamento aplica a regra a todos os colaboradores da mesma equipe/unidade em uma transação. Edição individual continua disponível, e a próxima sincronização aplica o mapeamento global. Alterar o escopo de unidades afeta apenas próximas consultas.

Testes: node --experimental-strip-types supabase/tests/quark-department-core.test.mjs. Validar frontend com tsc --noEmit -p tsconfig.app.json e npm run build. Em produção, testes SQL de inserção/atualização e RLS devem usar BEGIN/ROLLBACK.

Correspond�ncias autom�ticas: a migration quark_setor_auto_mapping normaliza acentos, espa�os, pontua��o e equival�ncias expl�citas como ADS E SERV, RH/DP e TLMK. Um trigger completa apenas mapeamentos vazios. Mapeamentos manuais existentes prevalecem; nomes gen�ricos e comerciais sem equival�ncia clara permanecem pendentes. A corre��o atualiza apenas setor, pend�ncia e metadados de atualiza��o dos colaboradores j� sincronizados.
