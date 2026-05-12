<script setup>
import { reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { Home } from 'lucide-vue-next'

const auth = useAuthStore()
const form = reactive({ name: '', email: '', password: '', password_confirmation: '' })
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/30 px-4">
    <div class="w-full max-w-sm animate-fade-in">
      <div class="mb-8 flex flex-col items-center gap-2 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Home class="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight">Create account</h1>
        <p class="text-sm text-muted-foreground">Join your family on Pamilya Hub</p>
      </div>

      <UiCard>
        <UiCardContent class="pt-6">
          <div v-if="auth.error" class="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {{ auth.error }}
          </div>

          <form @submit.prevent="auth.register(form)" class="space-y-4">
            <div class="space-y-1.5">
              <UiLabel for="name">Full Name</UiLabel>
              <UiInput id="name" v-model="form.name" type="text" placeholder="Juan dela Cruz" required />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="email">Email</UiLabel>
              <UiInput id="email" v-model="form.email" type="email" placeholder="you@example.com" required />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="password">Password</UiLabel>
              <UiInput id="password" v-model="form.password" type="password" placeholder="Min. 8 characters" required />
            </div>
            <div class="space-y-1.5">
              <UiLabel for="confirm">Confirm Password</UiLabel>
              <UiInput id="confirm" v-model="form.password_confirmation" type="password" placeholder="••••••••" required />
            </div>
            <UiButton type="submit" :disabled="auth.loading" class="w-full">
              {{ auth.loading ? 'Creating account…' : 'Create account' }}
            </UiButton>
          </form>

          <p class="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?
            <RouterLink to="/login" class="font-medium text-primary hover:underline underline-offset-4">Sign in</RouterLink>
          </p>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>
