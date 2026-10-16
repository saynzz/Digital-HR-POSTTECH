.PHONY: up dev down logs reset test model

up:
	docker compose up --build -d
	@echo "Веб: http://localhost:3000 · API: http://localhost:8000/docs"

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

down:
	docker compose down

logs:
	docker compose logs -f backend ollama-init

reset:
	docker compose down
	docker volume rm $$(basename $$(pwd))_db_data 2>/dev/null || true

test:
	docker compose run --rm --no-deps -e DATABASE_URL=sqlite:///./test.db -e LLM_PROVIDER=none backend pytest -q

model:
	docker compose exec ollama ollama pull $${LLM_MODEL:-qwen2.5:3b}
