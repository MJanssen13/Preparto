# Alternativas de Banco de Dados

Atualmente, o projeto utiliza uma abordagem híbrida: **Supabase** (quando configurado) com fallback para **LocalStorage**. Abaixo estão as melhores alternativas para evoluir a arquitetura do projeto.

## 1. Dexie.js (IndexedDB) - A Melhor Opção "Local"
Se o objetivo é ter um aplicativo robusto que funcione offline e sem configuração de backend, o **Dexie.js** é a melhor alternativa ao LocalStorage.

*   **O que é:** Um wrapper leve para o IndexedDB (banco de dados nativo do navegador).
*   **Vantagens:**
    *   **Capacidade:** Suporta centenas de megabytes (vs 5MB do LocalStorage).
    *   **Performance:** Assíncrono (não trava a interface) e indexado (buscas rápidas).
    *   **Tipagem:** Ótimo suporte a TypeScript.
    *   **Consultas:** Permite queries complexas (`where('age').above(18)`).
*   **Desvantagens:** Os dados ficam apenas no dispositivo do usuário (não sincroniza entre médicos diferentes sem um backend).

## 2. Firebase (Firestore) - A Alternativa Cloud
Se o objetivo é manter a sincronização em tempo real entre dispositivos (vários médicos acessando os mesmos dados), mas você não está satisfeito com o Supabase.

*   **O que é:** Plataforma do Google (Backend-as-a-Service).
*   **Vantagens:**
    *   Sincronização em tempo real extremamente robusta.
    *   Modo offline nativo (funciona sem internet e sincroniza quando volta).
    *   Ecossistema maduro.
*   **Desvantagens:** Vendor lock-in (difícil sair depois), consultas relacionais são mais limitadas que no Supabase (SQL).

## 3. SQLite (WASM) - SQL no Navegador
Se você gosta de SQL mas quer rodar tudo localmente no navegador.

*   **O que é:** A versão completa do SQLite rodando via WebAssembly.
*   **Vantagens:** Use SQL padrão completo. O arquivo do banco pode ser exportado/importado facilmente.
*   **Desvantagens:** Carregamento inicial mais pesado.

## 4. PouchDB / CouchDB
Se você precisa de "Offline First" com sincronização eventual.

*   **O que é:** Banco NoSQL que roda no navegador (PouchDB) e sincroniza automaticamente com o servidor (CouchDB).
*   **Vantagens:** O melhor protocolo de sincronização do mercado.
*   **Desvantagens:** Sintaxe de consulta (Map/Reduce) é mais complexa e antiga.

---

## Recomendação

1.  **Para um app de uso individual/protótipo robusto:** Migrar de `LocalStorage` para **Dexie.js**. É muito mais seguro e performático.
2.  **Para um app colaborativo (equipe médica):** Manter **Supabase** ou migrar para **Firebase**. O Supabase é geralmente preferido hoje em dia por ser SQL (Relacional), o que se ajusta melhor a dados estruturados de pacientes do que o NoSQL do Firebase.

### Próximos Passos Sugeridos
Posso refatorar o código para implementar o **Padrão Repository**. Isso isolaria a lógica do banco de dados, permitindo que troquemos entre Supabase, Dexie ou Firebase facilmente sem quebrar o resto do app.
